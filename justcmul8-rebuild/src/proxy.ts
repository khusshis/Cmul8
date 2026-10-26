import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Authenticated by HMAC signature, not cookies, and called by Razorpay's servers.
const CSRF_EXEMPT = new Set(["/api/billing/webhook"]);

/**
 * CSRF: a cookie-authenticated mutation must come from this site. Browsers send
 * Origin on every POST/PUT/PATCH/DELETE; Referer and Sec-Fetch-Site are fallbacks.
 * A request with none of them is not from a browser, so it carries no ambient cookies.
 */
function isSameOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (source) {
    try {
      return new URL(source).host === host;
    } catch {
      return false; // includes Origin: null (sandboxed frames, data: URLs)
    }
  }
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin";
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // API routes do their own getUser() check; here they only get the CSRF gate.
  if (path.startsWith("/api/")) {
    if (STATE_CHANGING.has(request.method) && !CSRF_EXEMPT.has(path) && !isSameOrigin(request)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const redirectTo = (pathname: string, params: Record<string, string> = {}) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c)); // keep refreshed session
    return res;
  };

  // Every matched route needs a session.
  if (!user) return redirectTo("/login", { redirect: path });

  // Two-factor: an account with a verified TOTP factor must enter its code before any page.
  // (The database enforces the same rule for direct API calls: security.sql §9.)
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return redirectTo("/login", { mfa: "1", redirect: path });

  // New accounts finish onboarding before anything else. The flag lives in
  // user_metadata (no extra query); it is a UX gate, not a security boundary.
  const onboarded = user.user_metadata?.onboarded === true;
  if (!onboarded && !path.startsWith("/onboarding")) return redirectTo("/onboarding", { next: path });
  if (onboarded && path.startsWith("/onboarding")) return redirectTo("/dashboard");

  return supabaseResponse;
}

// Pages: everything that needs a session. /share/* stays public (it checks access
// itself) and /auth/callback must run before a session exists.
export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/onboarding/:path*", "/api/:path*"],
};
