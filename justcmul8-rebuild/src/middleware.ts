import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
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

  const path = request.nextUrl.pathname;
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

  // New accounts finish onboarding before anything else. The flag lives in
  // user_metadata (no extra query); it is a UX gate, not a security boundary.
  const onboarded = user.user_metadata?.onboarded === true;
  if (!onboarded && !path.startsWith("/onboarding")) return redirectTo("/onboarding", { next: path });
  if (onboarded && path.startsWith("/onboarding")) return redirectTo("/dashboard");

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/onboarding"],
};
