"use client";
import React from "react";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { Stagger, Item, FormTitle, SubmitButton, FormError, SuccessState, useIntroDelay } from "@/components/auth/authUi";

function BackToLogin() {
  return (
    <Link href="/login" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#5742FF] hover:text-[#4531E5] transition-colors group">
      <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" /> Back to log in
    </Link>
  );
}

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);
  const delay = useIntroDelay();

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent("/update-password")}`,
    });
    if (error) {
      setError(
        error.message.toLowerCase().includes("rate limit")
          ? "You've requested too many reset links. Please wait a few minutes and try again."
          : error.message
      );
      setLoading(false);
      return;
    }
    setLoading(false);
    setSuccess(true);
  }

  if (success) {
    return (
      <SuccessState title="Check your inbox" action={<BackToLogin />}>
        If an account exists for <b className="text-[#161622]">{email}</b>, a password reset link is on its way.
      </SuccessState>
    );
  }

  return (
    <Stagger delay={delay}>
      <FormTitle title="Reset your password" sub="Enter the email you signed up with and we'll send you a reset link." />
      <FormError message={error} />
      <form onSubmit={handleResetPassword} className="space-y-3.5">
        <Item>
          <FloatingInput
            id="reset-email"
            label="Email address"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={18} strokeWidth={1.8} />}
          />
        </Item>
        <Item className="pt-1">
          <SubmitButton loading={loading}>Send reset link</SubmitButton>
        </Item>
      </form>
      <Item className="mt-6 text-center">
        <BackToLogin />
      </Item>
    </Stagger>
  );
}
