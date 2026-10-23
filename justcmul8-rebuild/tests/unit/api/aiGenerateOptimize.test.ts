import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabase } from "./supabaseMock";

const supabaseRef: any = { current: makeSupabase() };
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabaseRef.current) }));
vi.mock("@/lib/billing/server", () => ({
  withCredits: (_a: string, req: Request, handler: (r: Request) => Promise<Response>) => handler(req),
}));
const generateJSON = vi.fn();
vi.mock("@/lib/ai/modelRouter", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/modelRouter")>();
  return { ...actual, generateJSON };
});

const user = { id: "u1", email: "a@example.com" };
const post = (path: string, Fn: any, body: any) => Fn(new Request(`http://x${path}`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

beforeEach(() => { supabaseRef.current = makeSupabase({ user }); generateJSON.mockReset(); });
afterEach(() => vi.clearAllMocks());

describe("POST /api/ai/generate", () => {
  it("401 unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const { POST } = await import("@/app/api/ai/generate/route");
    expect((await post("/api/ai/generate", POST, { prompt: "a bank" })).status).toBe(401);
  });
  it("400 on an empty / oversized prompt", async () => {
    const { POST } = await import("@/app/api/ai/generate/route");
    expect((await post("/api/ai/generate", POST, { prompt: "" })).status).toBe(400);
    expect((await post("/api/ai/generate", POST, { prompt: "x".repeat(4001) })).status).toBe(400);
  });
  it("builds a graph from the model's nodes/edges", async () => {
    generateJSON.mockResolvedValue({
      text: JSON.stringify({ nodes: [{ id: "s", nodeType: "source", label: "In", position: { x: 0, y: 0 }, params: { arrivalRate: 1 } }, { id: "k", nodeType: "sink", label: "Out", position: { x: 200, y: 0 }, params: {} }], edges: [{ id: "e", source: "s", target: "k" }] }),
      model: "m",
    });
    const { POST } = await import("@/app/api/ai/generate/route");
    const res = await post("/api/ai/generate", POST, { prompt: "a source into a sink", simType: "human_queue" });
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.nodes.map((n: any) => n.id).sort()).toEqual(["k", "s"]);
    expect(b.edges).toHaveLength(1);
  });
  it("502 when the model returns no valid blocks", async () => {
    generateJSON.mockResolvedValue({ text: "not json at all", model: "m" });
    const { POST } = await import("@/app/api/ai/generate/route");
    expect((await post("/api/ai/generate", POST, { prompt: "x", simType: "human_queue" })).status).toBe(502);
  });
});

describe("POST /api/ai/optimize", () => {
  const result = { bottleneckNodeId: "r", nodeStats: { r: { label: "R", nodeType: "resource", utilization: 0.9, avgWaitTime: 5 } }, totalArrived: 10, totalCompleted: 8, totalSimTime: 100 };
  it("401 unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const { POST } = await import("@/app/api/ai/optimize/route");
    expect((await post("/api/ai/optimize", POST, { result, simType: "human_queue" })).status).toBe(401);
  });
  it("400 when result or simType is missing", async () => {
    const { POST } = await import("@/app/api/ai/optimize/route");
    expect((await post("/api/ai/optimize", POST, {})).status).toBe(400);
  });
  it("sanitizes recommendations and only keeps fixes for real nodes", async () => {
    generateJSON.mockResolvedValue({
      text: JSON.stringify({ recommendations: [
        { title: "Add a server", action: "do it", impact: "faster", confidence: 90, fix: { nodeId: "r", paramPatch: { capacity: 2, bogus: "x" }, description: "cap 2" } },
        { title: "Ghost fix", action: "x", impact: "y", confidence: 50, fix: { nodeId: "does_not_exist", paramPatch: { capacity: 9 }, description: "no" } },
      ] }),
      model: "m",
    });
    const { POST } = await import("@/app/api/ai/optimize/route");
    const res = await post("/api/ai/optimize", POST, { result, simType: "human_queue" });
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.recommendations).toHaveLength(2);
    expect(b.recommendations[0].fix.paramPatch).toEqual({ capacity: 2 }); // bogus key dropped
    expect(b.recommendations[1].fix).toBeUndefined(); // unknown node dropped
  });
});
