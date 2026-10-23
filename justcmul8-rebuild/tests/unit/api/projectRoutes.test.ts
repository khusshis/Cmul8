import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabase } from "./supabaseMock";

const supabaseRef: any = { current: makeSupabase() };
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabaseRef.current) }));

// requirePaid: let each test decide. Default = allowed (null).
const requirePaid = vi.fn<(...a: any[]) => Promise<any>>(async () => null);
vi.mock("@/lib/billing/server", () => ({ requirePaid: (...a: any[]) => requirePaid(...a) }));

// Don't actually send email.
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: vi.fn(async () => ({})) }) } }));

const user = { id: "owner1", email: "owner@example.com" };
const PID = "11111111-1111-4111-8111-111111111111";
const params = (id: string = PID) => ({ params: Promise.resolve({ id }) });
const nreq = (url: string, method = "GET", body?: any) => {
  const { NextRequest } = require("next/server");
  return new NextRequest(url, { method, ...(body ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) });
};

beforeEach(() => { supabaseRef.current = makeSupabase({ user }); requirePaid.mockReset().mockResolvedValue(null); });
afterEach(() => vi.clearAllMocks());

describe("GET /api/projects/[id]/export", () => {
  it("401 unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const { GET } = await import("@/app/api/projects/[id]/export/route");
    expect((await GET(nreq("http://x/e?format=json"), params())).status).toBe(401);
  });
  it("404 when the project is not found", async () => {
    supabaseRef.current = makeSupabase({ user, tables: { "projects:select": { data: null, error: { message: "no" } } } });
    const { GET } = await import("@/app/api/projects/[id]/export/route");
    expect((await GET(nreq("http://x/e?format=json"), params())).status).toBe(404);
  });
  it("JSON export is free and returns an attachment", async () => {
    supabaseRef.current = makeSupabase({ user, tables: { "projects:select": { data: { name: "My Sim", sim_type: "human_queue", graph_json: { nodes: [], edges: [] } } } } });
    const { GET } = await import("@/app/api/projects/[id]/export/route");
    const res = await GET(nreq("http://x/e?format=json"), params());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("My_Sim.json");
  });
  it("404 on a non-UUID project id (before any DB call)", async () => {
    const { GET } = await import("@/app/api/projects/[id]/export/route");
    expect((await GET(nreq("http://x/e?format=json"), params("not-a-uuid"))).status).toBe(404);
  });
  it("CSV export is gated behind Pro", async () => {
    const { NextResponse } = require("next/server");
    requirePaid.mockResolvedValue(NextResponse.json({ error: "Pro", errorCode: "PRO_REQUIRED" }, { status: 402 }));
    supabaseRef.current = makeSupabase({ user, tables: { "projects:select": { data: { name: "S", sim_type: "human_queue", graph_json: {} } } } });
    const { GET } = await import("@/app/api/projects/[id]/export/route");
    expect((await GET(nreq("http://x/e?format=csv"), params())).status).toBe(402);
  });
});

describe("/api/projects/[id]/members", () => {
  it("POST 401 unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    expect((await POST(nreq("http://x/m", "POST", { email: "b@x.com", role: "editor" }), params())).status).toBe(401);
  });
  it("POST 403 for a non-owner", async () => {
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "editor" } } });
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    expect((await POST(nreq("http://x/m", "POST", { email: "b@x.com", role: "editor" }), params())).status).toBe(403);
  });
  it("POST 400 on an invalid email", async () => {
    requirePaid.mockResolvedValue(null);
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "owner" } } });
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    expect((await POST(nreq("http://x/m", "POST", { email: "not-an-email", role: "editor" }), params())).status).toBe(400);
  });
  it("POST 400 on an invalid role", async () => {
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "owner" } } });
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    expect((await POST(nreq("http://x/m", "POST", { email: "b@x.com", role: "admin" }), params())).status).toBe(400);
  });
  it("POST accepts an apostrophe in the local part (o'brien@x.com is valid)", async () => {
    requirePaid.mockResolvedValue(null);
    supabaseRef.current = makeSupabase({
      user,
      rpc: { project_role: { data: "owner" } },
      tables: {
        "project_members:upsert": { error: null },
        "projects:select": { data: { name: "P" } },
        "profiles:select": { data: { display_name: "Owner" } },
      },
    });
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    const res = await POST(nreq("http://x/m", "POST", { email: "o'brien@x.com", role: "editor" }), params());
    expect(res.status).toBe(200);
  });
  it("POST 400 when inviting yourself", async () => {
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "owner" } } });
    const { POST } = await import("@/app/api/projects/[id]/members/route");
    expect((await POST(nreq("http://x/m", "POST", { email: "owner@example.com", role: "editor" }), params())).status).toBe(400);
  });
  it("DELETE 403 for a non-owner", async () => {
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "viewer" } } });
    const { DELETE } = await import("@/app/api/projects/[id]/members/route");
    expect((await DELETE(nreq("http://x/m", "DELETE", { email: "b@x.com" }), params())).status).toBe(403);
  });
});

describe("/api/projects/[id]/share", () => {
  it("GET 401 unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const { GET } = await import("@/app/api/projects/[id]/share/route");
    expect((await GET(nreq("http://x/sh"), params())).status).toBe(401);
  });
  it("GET 404 when the caller has no role", async () => {
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: null } } });
    const { GET } = await import("@/app/api/projects/[id]/share/route");
    expect((await GET(nreq("http://x/sh"), params())).status).toBe(404);
  });
  it("GET: viewer sees role+people but no owner link", async () => {
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "viewer" }, project_collaborators: { data: [] } } });
    const { GET } = await import("@/app/api/projects/[id]/share/route");
    const res = await GET(nreq("http://x/sh"), params());
    const b = await res.json();
    expect(b.role).toBe("viewer");
    expect(b.link).toBeNull();
  });
  it("PATCH 403 for a non-owner", async () => {
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "editor" } } });
    const { PATCH } = await import("@/app/api/projects/[id]/share/route");
    expect((await PATCH(nreq("http://x/sh", "PATCH", { access: "anyone", role: "viewer" }), params())).status).toBe(403);
  });
  it("PATCH 400 on invalid access settings", async () => {
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "owner" } } });
    const { PATCH } = await import("@/app/api/projects/[id]/share/route");
    expect((await PATCH(nreq("http://x/sh", "PATCH", { access: "public", role: "owner" }), params())).status).toBe(400);
  });
  it("PATCH to 'anyone' is gated behind Pro", async () => {
    const { NextResponse } = require("next/server");
    requirePaid.mockResolvedValue(NextResponse.json({ error: "Pro" }, { status: 402 }));
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "owner" } } });
    const { PATCH } = await import("@/app/api/projects/[id]/share/route");
    expect((await PATCH(nreq("http://x/sh", "PATCH", { access: "anyone", role: "viewer" }), params())).status).toBe(402);
  });
  it("DELETE 403 for a non-owner", async () => {
    supabaseRef.current = makeSupabase({ user, rpc: { project_role: { data: "viewer" } } });
    const { DELETE } = await import("@/app/api/projects/[id]/share/route");
    expect((await DELETE(nreq("http://x/sh", "DELETE"), params())).status).toBe(403);
  });
});

describe("POST /api/account/delete", () => {
  it("401 unauthenticated", async () => {
    supabaseRef.current = makeSupabase({ user: null });
    const { POST } = await import("@/app/api/account/delete/route");
    expect((await POST()).status).toBe(401);
  });
});
