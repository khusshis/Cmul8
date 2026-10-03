"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { Stagger, Item, FormTitle, SubmitButton, FormError, Divider, OAuthButtons, SuccessState, StrengthMeter, useIntroDelay } from "@/components/auth/authUi";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);
  const delay = useIntroDelay();
  // Where to land after confirming (e.g. an invited project). Same-origin paths only.
  const [redirect, setRedirect] = React.useState("/dashboard");
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("redirect");
    if (r && r.startsWith("/") && !r.startsWith("//")) setRedirect(r);
    // Plan picked on the pricing page: pre-select it in onboarding.
    else if (q.get("plan") === "pro") setRedirect(`/onboarding?plan=pro&billing=${q.get("billing") === "yearly" ? "yearly" : "monthly"}`);
  }, []);
  const callbackUrl = () => `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    // Email confirmation disabled in Supabase → already signed in.
    if (data.session) { router.push(redirect); router.refresh(); return; }
    setLoading(false);
    setSuccess(true);
  }

  async function handleOAuth(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
  }

  if (success) {
    return (
      <SuccessState
        title="Check your inbox"
        action={
          <button onClick={() => setSuccess(false)} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#5742FF] hover:text-[#4531E5] transition-colors">
            <ArrowLeft size={15} /> Use a different email
          </button>
        }
      >
        We sent a confirmation link to <b className="text-[#161622]">{email}</b>. Click it to activate your account.
      </SuccessState>
    );
  }

  return (
    <Stagger delay={delay}>
      <FormTitle title="Create your account" sub="Start free. No credit card, no installs." />
      <FormError message={error} />
      <form onSubmit={handleSignup} className="space-y-3.5">
        <Item>
          <FloatingInput
            id="signup-email"
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
            id="signup-password"
            label="Create a password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={18} strokeWidth={1.8} />}
          />
          <StrengthMeter password={password} />
        </Item>
        <Item className="pt-1">
          <SubmitButton loading={loading}>Create account</SubmitButton>
        </Item>
      </form>
      <Divider />
      <OAuthButtons onClick={handleOAuth} />
    </Stagger>
  );
}
