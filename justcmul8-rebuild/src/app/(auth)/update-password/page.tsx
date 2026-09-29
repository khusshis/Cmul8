"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { FloatingInput } from "@/components/ui/FloatingInput";
import { Stagger, Item, FormTitle, SubmitButton, FormError, SuccessState, StrengthMeter, useIntroDelay } from "@/components/auth/authUi";

const REDIRECT_MS = 2000;

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);
  const delay = useIntroDelay();

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    setLoading(false);
    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), REDIRECT_MS);
  }

  if (success) {
    return (
      <SuccessState
        title="Password updated"
        action={
          // Progress bar that fills over the redirect delay.
          <div className="mx-auto w-40 h-1 rounded-full bg-[#eeedf7] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#5742FF] origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: REDIRECT_MS / 1000, ease: "linear" }}
            />
          </div>
        }
      >
        You&apos;re all set. Taking you to your simulations…
      </SuccessState>
    );
  }

  return (
    <Stagger delay={delay}>
      <FormTitle title="Set a new password" sub="Your new password must be at least 6 characters." />
      <FormError message={error} />
      <form onSubmit={handleUpdatePassword} className="space-y-3.5">
        <Item>
          <FloatingInput
            id="new-password"
            label="New password"
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
          <SubmitButton loading={loading}>Update password</SubmitButton>
        </Item>
      </form>
    </Stagger>
  );
}
