import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabase } from "./supabaseMock";

const supabaseRef: any = { current: makeSupabase() };
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabaseRef.current) }));
// withCredits normally charges credits; bypass it so these tests exercise the handler's own
// auth/validation/parsing. (Credit charging is covered in billing/server.test.ts.)
vi.mock("@/lib/billing/server", () => ({
  withCredits: (_action: string, req: Request, handler: (r: Request) => Promise<Response>) => handler(req),
}));
const generateJSON = vi.fn();
vi.mock("@/lib/ai/modelRouter", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/modelRouter")>();
  return { ...actual, generateJSON };
});

const { POST } = await import("@/app/api/ai/chat/route");
const post = (body: any) => POST(new Request("http://localhost/api/ai/chat", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));
const user = { id: "u1", email: "a@example.com" };

beforeEach(() => {
  supabaseRef.current = makeSupabase({ user });
  generateJSON.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/ai/chat", () => {
  it("401 when unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const res = await post({ prompt: "hi" });
    expect(res.status).toBe(401);
    expect((await res.json()).errorCode).toBe("UNAUTHENTICATED");
  });

  it("400 on an empty prompt", async () => {
    const res = await post({ prompt: "   " });
    expect(res.status).toBe(400);
  });

  it("400 when the prompt is too long", async () => {
    const res = await post({ prompt: "x".repeat(4001) });
    expect(res.status).toBe(400);
    expect((await res.json()).errorCode).toBe("PROMPT_TOO_LONG");
  });

  it("400 when the canvas has too many blocks", async () => {
    const nodes = Array.from({ length: 301 }, (_, i) => ({ id: `n${i}`, data: { nodeType: "source", label: "x", params: {} } }));
    const res = await post({ prompt: "go", currentGraph: { nodes, edges: [] } });
    expect(res.status).toBe(400);
    expect((await res.json()).errorCode).toBe("CANVAS_TOO_LARGE");
  });

  it("applies a valid model edit and returns ops", async () => {
    generateJSON.mockResolvedValue({
      text: JSON.stringify({ actionType: "ADD_NODES", text: "Added a server.", addNodes: [{ id: "r", nodeType: "resource", label: "Server", params: { capacity: 1, serviceTimeMean: 2 } }] }),
      model: "gemini-3.6-flash",
    });
    const res = await post({ prompt: "add a server", currentGraph: { nodes: [], edges: [] } });
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.ok).toBe(true);
    expect(b.actionType).toBe("ADD_NODES");
    expect(b.ops.upsertNodes[0].id).toBe("r");
  });

  it("returns prose as an answer (actionType NONE) when the model doesn't emit JSON", async () => {
    generateJSON.mockResolvedValue({ text: "Your bottleneck is the single teller.", model: "m" });
    const res = await post({ prompt: "why is it slow?" });
    const b = await res.json();
    expect(b.ok).toBe(true);
    expect(b.actionType).toBe("NONE");
    expect(b.text).toContain("teller");
  });

  it("maps an AIRouterError (quota) to its HTTP status", async () => {
    const { AIRouterError } = await import("@/lib/ai/modelRouter");
    generateJSON.mockRejectedValue(new AIRouterError("QUOTA", "Limit reached. Try again in 30 seconds.", 429, true, 30));
    const res = await post({ prompt: "hi" });
    expect(res.status).toBe(429);
    const b = await res.json();
    expect(b.errorCode).toBe("QUOTA");
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});
