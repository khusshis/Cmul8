import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/safeRedirect";
import { consentRecord, hasConsent } from "@/lib/consent";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = safeRedirect(searchParams.get("redirect"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ticked on the sign-up page. Record it once; a failure here must not block sign-in
      // (onboarding asks again for anyone still without a record).
      if (searchParams.get("consent") === "1" && data.user && !hasConsent(data.user.user_metadata)) {
        await supabase.auth.updateUser({ data: { consent: consentRecord() } }).catch(() => {});
      }
      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
