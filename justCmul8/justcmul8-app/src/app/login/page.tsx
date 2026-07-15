"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { JustCmul8Icon } from "@/components/ui/JustCmul8Icon";

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/dashboard";
  const supabase = createClient();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push(redirect);
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
    });
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-16" style={{ background: "var(--bg-primary)" }}>
      <div className="fixed inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div className="fixed inset-0 scanlines pointer-events-none" />

      {/* Corner decorations */}
      {[["top-4 left-4 border-t-2 border-l-2",""], ["top-4 right-4 border-t-2 border-r-2",""], ["bottom-4 left-4 border-b-2 border-l-2",""], ["bottom-4 right-4 border-b-2 border-r-2",""]].map(([cls], i) => (
        <div key={i} className={`fixed w-8 h-8 ${cls} border-neon-cyan opacity-40`} style={{ borderColor: "var(--neon-cyan)" }} />
      ))}

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <JustCmul8Icon className="w-8 h-8 text-neon-cyan drop-shadow-[0_0_8px_rgba(0,242,255,0.8)]" />
            <span className="font-display font-bold text-xl tracking-widest text-neon-cyan text-glow-cyan" style={{ fontFamily: "var(--font-display)" }}>JUSTCMUL8</span>
          </Link>
          <h1 className="font-display font-bold text-white text-2xl tracking-wider" style={{ fontFamily: "var(--font-display)" }}>SYSTEM LOGIN</h1>
          <p className="text-sm mt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Authenticate to access your simulation workspace</p>
        </div>

        <div className="glass-panel-heavy p-8 space-y-6">
          {error && (
            <div className="text-sm px-4 py-3 rounded" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontFamily: "var(--font-mono)", color: "var(--neon-red)" }}>
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                <Mail size={12} className="inline mr-1" /> EMAIL
              </label>
              <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="input-cyber" placeholder="operator@justcmul8.com" />
            </div>
            <div>
              <label className="block text-xs tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                <Lock size={12} className="inline mr-1" /> PASSWORD
              </label>
              <div className="relative">
                <input id="login-password" type={showPw ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input-cyber pr-10" placeholder="••••••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-neon-cyan transition-colors"
                  style={{ color: "var(--text-muted)" }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button id="login-submit" type="submit" disabled={loading} className="btn-cyber-primary w-full justify-center mt-2" style={{ padding: "14px" }}>
              {loading ? "AUTHENTICATING..." : <><LogIn size={16} /> LOGIN</>}
            </button>
          </form>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
            <span className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>OR</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button id="login-google" onClick={() => handleOAuth("google")} className="btn-cyber-ghost justify-center" style={{ padding: "10px" }}>
              <span>G</span> Google
            </button>
            <button id="login-github" onClick={() => handleOAuth("github")} className="btn-cyber-ghost justify-center" style={{ padding: "10px" }}>
              <span>⌥</span> GitHub
            </button>
          </div>
        </div>

        <p className="text-center mt-6 text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>
          No account?{" "}
          <Link href="/signup" className="text-neon-cyan hover:underline">Create one →</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}><div className="text-xs animate-pulse" style={{ fontFamily: "var(--font-mono)", color: "var(--neon-cyan)" }}>LOADING...</div></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
