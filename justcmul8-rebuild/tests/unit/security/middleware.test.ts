import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy as middleware } from "@/proxy";

function apiReq(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://app.example.com/api/projects/x/members", {
    method,
    headers: { host: "app.example.com", ...headers },
  });
}

describe("middleware CSRF gate (/api/*)", () => {
  it("allows a same-origin mutation (Origin matches host)", async () => {
    const res = await middleware(apiReq("POST", { origin: "https://app.example.com" }));
    expect(res.status).not.toBe(403);
  });
  it("blocks a cross-site mutation (Origin differs)", async () => {
    const res = await middleware(apiReq("POST", { origin: "https://evil.com" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/cross-site/i);
  });
  it("blocks Origin: null", async () => {
    expect((await middleware(apiReq("POST", { origin: "null" }))).status).toBe(403);
  });
  it("falls back to Referer, then to Sec-Fetch-Site", async () => {
    expect((await middleware(apiReq("PATCH", { referer: "https://app.example.com/x" }))).status).not.toBe(403);
    expect((await middleware(apiReq("DELETE", { referer: "https://evil.com/x" }))).status).toBe(403);
    expect((await middleware(apiReq("POST", { "sec-fetch-site": "same-origin" }))).status).not.toBe(403);
    expect((await middleware(apiReq("POST", { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });
  it("never blocks safe methods (GET/HEAD) regardless of origin", async () => {
    expect((await middleware(apiReq("GET", { origin: "https://evil.com" }))).status).not.toBe(403);
  });
  it("exempts the Razorpay webhook (HMAC-authenticated, no cookies)", async () => {
    const req = new NextRequest("https://app.example.com/api/billing/webhook", {
      method: "POST",
      headers: { host: "app.example.com", origin: "https://api.razorpay.com" },
    });
    expect((await middleware(req)).status).not.toBe(403);
  });
  it("honours x-forwarded-host behind a proxy", async () => {
    const req = new NextRequest("https://internal/api/x", {
      method: "POST",
      headers: { host: "internal", "x-forwarded-host": "app.example.com", origin: "https://app.example.com" },
    });
    expect((await middleware(req)).status).not.toBe(403);
  });
});
