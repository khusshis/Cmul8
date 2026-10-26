"use client";
import { safeRedirect } from "@/lib/safeRedirect";
import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Turnstile, captchaEnabled } from "@/components/auth/Turnstile";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { Stagger, Item, FormTitle, SubmitButton, FormError, Divider, OAuthButtons, useIntroDelay } from "@/components/auth/authUi";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawRedirect = params.get("redirect");
  const redirect = safeRedirect(rawRedirect);
  const supabase = createClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  // /auth/callback sends failed or cancelled Google/GitHub sign-ins back here with ?error=auth_failed.
  const [error, setError] = React.useState(
    params.get("error") === "auth_failed" ? "That sign-in didn't complete. Please try again, or use your email and password." : ""
  );
  const delay = useIntroDelay();
  const [captcha, setCaptcha] = React.useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = React.useState(0); // re-mount = fresh single-use token
  const nextCaptcha = () => { setCaptcha(null); setCaptchaKey((k) => k + 1); };
  // Two-factor step: set when the account has a verified TOTP factor and this session hasn't used it yet.
  const [mfaFactor, setMfaFactor] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");

  /** True when this session still needs a TOTP code (the proxy sends such sessions here with ?mfa=1). */
  async function needsCode() {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.nextLevel !== "aal2" || data.currentLevel === "aal2") return false;
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const id = factors?.totp?.[0]?.id;
    if (id) setMfaFactor(id);
    return !!id;
  }

  React.useEffect(() => {
    if (params.get("mfa") !== "1") return;
    Promise.resolve().then(needsCode); // async: state updates land after the effect
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (captchaEnabled && !captcha) { setError("Please complete the security check."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captcha ?? undefined } });
    nextCaptcha();
    if (error) { setError(error.message); setLoading(false); return; }
    if (await needsCode()) { setLoading(false); return; }
    router.push(redirect);
    router.refresh();
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactor || code.length !== 6) return;
    setLoading(true); setError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactor, code });
    if (error) { setError("That code didn't match. Try the newest code from your authenticator app."); setLoading(false); setCode(""); return; }
    router.push(redirect);
    router.refresh();
  }

  async function useAnotherAccount() {
    await supabase.auth.signOut();
    setMfaFactor(null); setCode(""); setPassword(""); setError("");
  }

  async function handleOAuth(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}` },
    });
  }

  if (mfaFactor) {
    return (
      <Stagger delay={0}>
        <FormTitle title="Enter your 6-digit code" sub="Open your authenticator app and enter the code for JustCmul8." />
        <FormError message={error} />
        <form onSubmit={handleCode} className="space-y-3.5">
          <Item>
            <FloatingInput
              id="login-mfa"
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              icon={<Smartphone size={18} strokeWidth={1.8} />}
            />
          </Item>
          <Item className="pt-1">
            <SubmitButton loading={loading}>Verify</SubmitButton>
          </Item>
        </form>
        <Item>
          <button onClick={useAnotherAccount} className="mt-5 w-full text-center text-[12.5px] font-semibold text-fg-64748b hover:text-fg-5742ff transition-colors">
            Use a different account
          </button>
        </Item>
      </Stagger>
    );
  }

  return (
    <Stagger delay={delay}>
      <FormTitle title="Log in to your workspace" sub="Welcome back! Enter your details to continue building." />
      <FormError message={error} />
      <form onSubmit={handleLogin} className="space-y-3.5">
        <Item>
          <FloatingInput
            id="login-email"
            label="Email address"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={18} strokeWidth={1.8} />}
          />
        </Item>
        <Item>
          <FloatingInput
            id="login-password"
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={18} strokeWidth={1.8} />}
          />
          <div className="flex justify-end mt-2.5">
            <Link href="/forgot-password" className="text-[12.5px] font-semibold text-fg-5742ff hover:text-fg-4531e5 transition-colors">
              Forgot password?
            </Link>
          </div>
        </Item>
        <Item>
          <Turnstile key={captchaKey} onToken={setCaptcha} />
        </Item>
        <Item className="pt-1">
          <SubmitButton loading={loading}>Log in</SubmitButton>
        </Item>
      </form>
      <Divider />
      <OAuthButtons onClick={handleOAuth} />
    </Stagger>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
