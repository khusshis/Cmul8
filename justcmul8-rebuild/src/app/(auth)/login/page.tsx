"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { Stagger, Item, FormTitle, SubmitButton, FormError, Divider, OAuthButtons, useIntroDelay } from "@/components/auth/authUi";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawRedirect = params.get("redirect");
  const redirect = rawRedirect?.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";
  const supabase = createClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const delay = useIntroDelay();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push(redirect);
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}` },
    });
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
            <Link href="/forgot-password" className="text-[12.5px] font-semibold text-[#5742FF] hover:text-[#4531E5] transition-colors">
              Forgot password?
            </Link>
          </div>
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
