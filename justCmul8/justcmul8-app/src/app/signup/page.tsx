"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { JustCmul8Icon } from "@/components/ui/JustCmul8Icon";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess(true);
  }

  async function handleOAuth(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-16" style={{ background: "var(--bg-primary)" }}>
      <div className="fixed inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div className="fixed inset-0 scanlines pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <JustCmul8Icon className="w-8 h-8 text-neon-cyan drop-shadow-[0_0_8px_rgba(0,242,255,0.8)]" />
            <span className="font-display font-bold text-xl tracking-widest text-neon-cyan text-glow-cyan" style={{ fontFamily: "var(--font-display)" }}>JUSTCMUL8</span>
          </Link>
          <h1 className="font-display font-bold text-white text-2xl tracking-wider" style={{ fontFamily: "var(--font-display)" }}>CREATE ACCOUNT</h1>
          <p className="text-sm mt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Join the simulation platform · Free forever</p>
        </div>

        <div className="glass-panel-heavy p-8 space-y-6">
          {success ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-4xl">✅</div>
              <p className="font-display font-bold text-neon-green" style={{ fontFamily: "var(--font-display)" }}>ACCOUNT CREATED</p>
              <p className="text-sm" style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>Check your email to confirm your account, then log in.</p>
              <Link href="/login" className="btn-cyber-primary inline-flex mt-4">GO TO LOGIN</Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="text-sm px-4 py-3 rounded" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontFamily: "var(--font-mono)", color: "var(--neon-red)" }}>
                  ❌ {error}
                </div>
              )}
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-xs tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    <Mail size={12} className="inline mr-1" /> EMAIL
                  </label>
                  <input id="signup-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input-cyber" placeholder="operator@justcmul8.com" />
                </div>
                <div>
                  <label className="block text-xs tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    <Lock size={12} className="inline mr-1" /> PASSWORD
                  </label>
                  <div className="relative">
                    <input id="signup-password" type={showPw ? "text" : "password"} required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="input-cyber pr-10" placeholder="Min. 8 characters" />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: "var(--text-muted)" }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button id="signup-submit" type="submit" disabled={loading} className="btn-cyber-primary w-full justify-center mt-2" style={{ padding: "14px" }}>
                  {loading ? "CREATING ACCOUNT..." : <><UserPlus size={16} /> CREATE ACCOUNT</>}
                </button>
              </form>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
                <span className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>OR</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button id="signup-google" onClick={() => handleOAuth("google")} className="btn-cyber-ghost justify-center" style={{ padding: "10px" }}>
                  <span>G</span> Google
                </button>
                <button id="signup-github" onClick={() => handleOAuth("github")} className="btn-cyber-ghost justify-center" style={{ padding: "10px" }}>
                  <span>⌥</span> GitHub
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" className="text-neon-cyan hover:underline">Login →</Link>
        </p>
      </div>
    </div>
  );
}
