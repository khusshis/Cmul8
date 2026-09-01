"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Users, Layers, Server, Flag, CodeXml, Zap, Cloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

import { AuthDiagram } from "@/components/ui/AuthDiagram";
import { FloatingInput } from "@/components/ui/FloatingInput";

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

  // Form Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

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
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
    });
  }

  return (
    <div className="h-screen w-screen bg-[#F8F7FC] flex flex-col items-center justify-center font-sans text-[#111827] relative overflow-hidden">
        
        {/* Continuous Subtle Background Gradient */}
        <motion.div 
          animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
          transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
          className="fixed inset-0 opacity-15 pointer-events-none z-0" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 0% 40%, #C4B5FD 0%, transparent 50%), radial-gradient(circle at 100% 100%, #8B7CF6 0%, transparent 50%)',
            backgroundSize: '200% 200%'
          }} 
        />

        {/* Outer Container */}
        <div className="w-full h-full flex flex-col md:flex-row relative z-10">

          {/* LEFT PANEL */}
          <div className="w-full h-auto md:h-full md:w-1/2 px-6 md:px-12 py-6 lg:py-8 flex flex-col relative z-10">

          {/* Logo & Headline */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative z-10 flex-shrink-0 mb-2 lg:mb-4 flex flex-col items-center text-center md:items-start md:text-left"
          >
            <div className="mb-2 md:-ml-6 md:-mt-6">
              <img src="/logo_full.png" alt="JustCmul8 Logo" className="h-28 md:h-32 lg:h-36 w-auto object-contain md:object-left origin-center md:origin-left" />
            </div>
            <h1 className="text-[26px] md:text-[32px] lg:text-[40px] font-bold leading-[1.15] tracking-tight mb-1 lg:mb-2 text-[#111827] hidden md:block">
              Welcome back <br className="hidden lg:block" />
              to <span className="text-[#6C5CE7]">JustCmul8.</span>
            </h1>
            <p className="text-[#6B7280] text-[14px] lg:text-[15px] max-w-[400px] leading-relaxed hidden md:block">
              Sign in to access your models, run simulations, and collaborate with your team.
            </p>
          </motion.div>

          {/* Desktop Only: Diagram and Features Centered */}
          <div className="hidden md:flex flex-col flex-grow justify-center relative min-h-0">
            {/* The AuthDiagram will scale to fit available space */}
            <div className="w-full flex-grow flex items-center justify-center min-h-[200px] max-h-[340px]">
              <AuthDiagram />
            </div>
            
            {/* Feature Row */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="relative z-10 flex-shrink-0 pt-4 lg:pt-6 border-t border-[#E5E7EB]/70 grid grid-cols-3 gap-4 mt-2 lg:mt-6"
            >
              {[
                { icon: <CodeXml size={18} />, title: "No Code", sub: "Drag, drop, simulate." },
                { icon: <Zap size={18} />, title: "Real-time", sub: "Instant results." },
                { icon: <Cloud size={18} />, title: "Anywhere", sub: "All in browser." }
              ].map((f, idx) => (
                <motion.div 
                  whileHover={{ y: -3, transition: { duration: 0.2 } }} 
                  key={idx} 
                  className="flex flex-col gap-1 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#6C5CE7] shadow-sm border border-gray-100">
                    {f.icon}
                  </div>
                  <span className="font-bold text-[12px] lg:text-[13px] text-[#111827] leading-tight mt-0.5">{f.title}</span>
                  <span className="text-[11px] lg:text-[12px] text-[#6B7280] leading-tight">{f.sub}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* RIGHT PANEL - FORM */}
        <div className="w-full h-auto md:h-full md:w-1/2 bg-white px-6 md:px-12 py-8 lg:py-12 flex flex-col justify-center items-center shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.03)] relative z-20 overflow-y-auto no-scrollbar">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full max-w-[400px] my-auto"
          >
            <motion.h2 variants={itemVariants} className="text-[26px] lg:text-[32px] font-bold text-[#111827] mb-1 tracking-tight text-center md:text-left">
              Welcome back
            </motion.h2>
            {/* Desktop Subtext */}
            <motion.p variants={itemVariants} className="text-[#6B7280] text-[13px] lg:text-[14px] mb-5 lg:mb-6 leading-relaxed text-center md:text-left hidden md:block">
              Sign in to your account to continue building powerful simulations.
            </motion.p>
            {/* Mobile Subtext matching screenshot */}
            <motion.p variants={itemVariants} className="text-[#6B7280] text-[13px] mb-6 leading-relaxed text-center md:hidden px-4">
              Sign in to your account.
            </motion.p>


            <div className="space-y-5 lg:space-y-6">
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] px-4 py-3 rounded-lg bg-red-50 text-red-600 border border-red-100">
                  {error}
                </motion.div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <motion.div variants={itemVariants}>
                  <FloatingInput 
                    id="login-email" 
                    label="Email address"
                    type="email" 
                    required 
                    autoComplete="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Mail size={18} strokeWidth={1.5} />}
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <FloatingInput 
                    id="login-password" 
                    label="Password"
                    type="password" 
                    required 
                    autoComplete="current-password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Lock size={18} strokeWidth={1.5} />}
                  />
                  <div className="flex justify-end mt-2">
                    <Link href="/forgot-password" className="text-[13px] font-medium text-[#5742FF] hover:underline transition-all">
                      Forgot password?
                    </Link>
                  </div>
                </motion.div>

                <motion.button 
                  variants={itemVariants}
                  whileHover={{ scale: 1.01, boxShadow: "0 6px 20px rgba(108,92,231,0.23)", transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
                  id="login-submit" 
                  type="submit" 
                  disabled={loading} 
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-full text-[15px] text-white font-semibold transition-all disabled:opacity-70 mt-6 md:mt-4 bg-[#5742FF] hover:bg-[#4E3BE5] shadow-[0_4px_14px_0_rgba(108,92,231,0.25)]"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </motion.button>
              </form>

              <motion.div variants={itemVariants} className="relative flex items-center gap-4 py-2 md:py-1">
                <div className="flex-1 h-px bg-[#E5E7EB]" />
                <span className="text-[12px] text-[#6B7280]">or continue with</span>
                <div className="flex-1 h-px bg-[#E5E7EB]" />
              </motion.div>

              <motion.div variants={itemVariants} className="flex flex-row justify-center gap-4 md:flex-col md:gap-0 md:space-y-3">
                <motion.button 
                  whileHover={{ 
                    backgroundColor: "#F5F3FF", 
                    borderColor: "#C4B5FD", 
                    y: -1, 
                    boxShadow: "0 4px 12px rgba(196, 181, 253, 0.2)", 
                    transition: { duration: 0.2, ease: "easeOut" } 
                  }}
                  whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
                  onClick={() => handleOAuth("google")} 
                  className="flex items-center justify-center border border-[#E5E7EB] rounded-full font-semibold text-[14px] text-[#111827] bg-white shadow-sm w-[52px] h-[52px] md:w-full md:h-auto md:py-2.5 lg:py-3 md:px-4 md:gap-3"
                >
                  <svg className="w-[20px] h-[20px] md:w-[18px] md:h-[18px]" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                  <span className="hidden md:inline">Continue with Google</span>
                </motion.button>
                <motion.button 
                  whileHover={{ 
                    backgroundColor: "#F5F3FF", 
                    borderColor: "#C4B5FD", 
                    y: -1, 
                    boxShadow: "0 4px 12px rgba(196, 181, 253, 0.2)", 
                    transition: { duration: 0.2, ease: "easeOut" } 
                  }}
                  whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
                  onClick={() => handleOAuth("github")} 
                  className="flex items-center justify-center border border-[#E5E7EB] rounded-full font-semibold text-[14px] text-[#111827] bg-white shadow-sm w-[52px] h-[52px] md:w-full md:h-auto md:py-2.5 lg:py-3 md:px-4 md:gap-3"
                >
                  <svg className="w-[20px] h-[20px] md:w-[18px] md:h-[18px]" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                  <span className="hidden md:inline">Continue with GitHub</span>
                </motion.button>
              </motion.div>
            </div>

            <motion.p variants={itemVariants} className="text-center mt-6 lg:mt-8 text-[14px] text-[#111827]">
              Don't have an account?{" "}
              <Link href="/signup" className="font-bold text-[#5742FF] hover:underline">Sign up</Link>
            </motion.p>
            
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#F8F7FC] flex flex-col items-center justify-center font-sans text-[#111827]"><div className="text-sm font-semibold text-[#6C5CE7] animate-pulse">Loading...</div></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
