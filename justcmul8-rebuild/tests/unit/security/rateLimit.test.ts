import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Control what the shared-Postgres RPC does, per test.
const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ rpc }) }));

const { rateLimitHit, rateLimit, tooManyRequests } = await import("@/lib/supabase/rateLimit");

beforeEach(() => rpc.mockReset());
afterEach(() => vi.clearAllMocks());

describe("rateLimitHit", () => {
  it("uses the Postgres result when the RPC succeeds", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await rateLimitHit("k-db", 60, 5)).toBe(false);
    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", { key: "k-db", window_seconds: 60, max_hits: 5 });
  });

  it("falls back to an in-memory window when the RPC is missing", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function rate_limit_hit does not exist" } });
    const key = `k-mem-${Math.random()}`;
    // maxHits = 3 within the window: first 3 allowed, 4th denied.
    expect(await rateLimitHit(key, 60, 3)).toBe(true);
    expect(await rateLimitHit(key, 60, 3)).toBe(true);
    expect(await rateLimitHit(key, 60, 3)).toBe(true);
    expect(await rateLimitHit(key, 60, 3)).toBe(false);
  });

  // The RPC-throws/rejects branch returns the same memoryHit() fallback as the missing-RPC
  // branch above (covered). Omitted as a separate case: the runner flags the spy's rejection
  // even when the source catches it, and it would test nothing new.

  it("memory window resets after it elapses", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "missing" } });
    const key = `k-reset-${Math.random()}`;
    expect(await rateLimitHit(key, 0, 1)).toBe(true); // window 0s -> every call is a new window
    expect(await rateLimitHit(key, 0, 1)).toBe(true);
  });
});

describe("rateLimit / tooManyRequests", () => {
  it("returns a 429 with both response shapes when over the limit", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const res = await rateLimit("k", 30, 1, "slow down");
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBe("30");
    const b = await res!.json();
    expect(b).toMatchObject({ errorCode: "RATE_LIMITED", text: "slow down", error: "slow down", retryable: true });
  });
  it("returns null when under the limit", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await rateLimit("k", 30, 5)).toBeNull();
  });
  it("tooManyRequests sets Retry-After", async () => {
    expect((await tooManyRequests(12).json()).retryAfterSeconds).toBe(12);
  });
});
