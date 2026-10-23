// SERVER ONLY. Fixed-window rate limiting shared by every serverless instance via
// Postgres (public.rate_limit_hit in supabase/security.sql, service role only).
// Until that SQL is run, or if the call fails, it degrades to a per-instance
// in-memory window so the app keeps working, just with weaker limits.
import { NextResponse } from "next/server";
import { adminClient } from "./admin";

const memory = new Map<string, { start: number; hits: number }>();
let warned = false;

function memoryHit(key: string, windowSeconds: number, maxHits: number) {
  const now = Date.now();
  // ponytail: wholesale clear bounds memory; it only backs the fallback path.
  if (memory.size > 10_000) memory.clear();
  const entry = memory.get(key);
  if (!entry || now - entry.start >= windowSeconds * 1000) {
    memory.set(key, { start: now, hits: 1 });
    return true;
  }
  entry.hits += 1;
  return entry.hits <= maxHits;
}

/** Records one hit on `key`; true while the caller is within `maxHits` per `windowSeconds`. */
export async function rateLimitHit(key: string, windowSeconds: number, maxHits: number): Promise<boolean> {
  try {
    const { data, error } = await adminClient().rpc("rate_limit_hit", {
      key,
      window_seconds: windowSeconds,
      max_hits: maxHits,
    });
    if (!error && typeof data === "boolean") return data;
    if (!warned) console.error("[rateLimit] rate_limit_hit RPC failed, using in-memory fallback (run supabase/security.sql):", error?.message);
  } catch (err) {
    if (!warned) console.error("[rateLimit] rate_limit_hit RPC threw, using in-memory fallback:", err);
  }
  warned = true;
  return memoryHit(key, windowSeconds, maxHits);
}

/** 429 in both response shapes used by the app (`text` for the chat panel, `error` elsewhere). */
export function tooManyRequests(retryAfterSeconds: number, message = "Too many requests. Please wait a moment and try again.") {
  return NextResponse.json(
    { ok: false, errorCode: "RATE_LIMITED", text: message, error: message, retryable: true, retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/** A 429 response when `key` is over its limit, otherwise null. */
export async function rateLimit(key: string, windowSeconds: number, maxHits: number, message?: string) {
  return (await rateLimitHit(key, windowSeconds, maxHits)) ? null : tooManyRequests(windowSeconds, message);
}
