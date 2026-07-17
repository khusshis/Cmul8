"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ArrowLeft, MailCheck, CodeXml, Zap, Cloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { AuthDiagram } from "@/components/ui/AuthDiagram";
import { FloatingInput } from "@/components/ui/FloatingInput";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  // Form Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.updateUser({
      password: password
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess(true);
    // Optionally redirect immediately or let them click back to login
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  }

  return (
    <div className="h-screen w-screen bg-[#F8F7FC] flex flex-col items-center justify-center font-sans text-[#111827] relative overflow-hidden">
        {/* Continuous Subtle Background Gradient */}
        <motion.div 
          animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
          transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
          className="fixed md:absolute inset-0 opacity-15 pointer-events-none z-0" 
          style={{ backgroundImage: 'radial-gradient(circle at 0% 40%, #C4B5FD 0%, transparent 50%), radial-gradient(circle at 100% 100%, #8B7CF6 0%, transparent 50%)', backgroundSize: '200% 200%' }} 
        />

        {/* Outer Container */}
        <div className="w-full h-full 2xl:h-[85vh] 2xl:w-[85vw] 2xl:max-w-[2400px] 2xl:rounded-[40px] 2xl:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] 2xl:border 2xl:border-white/50 flex flex-col justify-center md:flex-row overflow-y-auto md:overflow-hidden relative z-10 bg-transparent 2xl:bg-white/50 backdrop-blur-3xl">

          {/* LEFT PANEL */}
          <div className="w-full h-auto md:h-full md:w-1/2 px-6 md:px-8 pt-8 pb-0 md:py-6 lg:px-12 lg:py-10 flex flex-col relative z-10 justify-start md:justify-between max-w-2xl mx-auto md:max-w-none 2xl:pl-16">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative z-10 flex-shrink-0 mb-0 flex flex-col items-center text-center md:items-start md:text-left"
            >
              <div className="mb-2 md:mb-2 lg:mb-4 md:-ml-6 md:-mt-6">
                <img src="/logo_full.png" alt="JustCmul8 Logo" className="h-36 md:h-28 lg:h-40 w-auto object-contain md:object-left origin-center md:origin-left scale-125" />
              </div>
              <h1 className="text-[28px] md:text-[32px] lg:text-[40px] font-bold leading-[1.15] tracking-tight mb-2 lg:mb-3 text-[#111827] hidden md:block">
                Build better systems <br className="hidden sm:block" />
                with <span className="text-[#6C5CE7]">powerful simulations.</span>
              </h1>
              <p className="text-[#6B7280] text-[15px] lg:text-[16px] max-w-[380px] leading-relaxed hidden md:block">
                No code. No setup. Just model, simulate, and optimize discrete event systems in your browser.
              </p>
            </motion.div>

            {/* Desktop Only: Diagram and Features */}
            <div className="hidden md:flex flex-col flex-grow justify-between">
              <AuthDiagram />
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.5 }}
                className="relative z-10 flex-shrink-0 pt-4 lg:pt-6 border-t border-[#E5E7EB]/50 grid grid-cols-3 gap-3"
              >
                {[
                  { icon: <CodeXml size={16} />, title: "No Code", sub: "Drag, drop, simulate." },
                  { icon: <Zap size={16} />, title: "Real-time", sub: "Instant results." },
                  { icon: <Cloud size={16} />, title: "Anywhere", sub: "All in browser." }
                ].map((f, idx) => (
                  <motion.div whileHover={{ y: -3, transition: { duration: 0.2 } }} key={idx} className="flex flex-col gap-1 cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#6C5CE7] mb-0.5 shadow-sm border border-gray-100">{f.icon}</div>
                    <span className="font-bold text-[12px] lg:text-[13px] text-[#111827] leading-tight">{f.title}</span>
                    <span className="text-[11px] lg:text-[12px] text-[#6B7280] leading-tight">{f.sub}</span>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* RIGHT PANEL - FORM */}
          <div className="w-full md:h-full md:w-1/2 bg-transparent md:bg-white px-6 md:px-8 pb-10 pt-8 md:pt-12 lg:pt-16 flex flex-col justify-start items-center overflow-y-visible md:overflow-y-auto rounded-none md:rounded-l-[48px] shadow-none md:shadow-[-30px_0_60px_-15px_rgba(0,0,0,0.08)] relative z-20">
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full max-w-[420px]">
              <motion.h2 variants={itemVariants} className="text-[28px] lg:text-[34px] font-bold text-[#111827] mb-1.5 md:mb-1.5 tracking-tight text-center md:text-left">
                Update password
              </motion.h2>
              <motion.p variants={itemVariants} className="text-[#6B7280] text-[13px] lg:text-[15px] mb-6 lg:mb-8 leading-relaxed text-center md:text-left hidden md:block">
                Please enter a new strong password for your account.
              </motion.p>
              <motion.p variants={itemVariants} className="text-[#6B7280] text-[14px] mb-8 leading-relaxed text-center md:hidden px-4">
                Enter your new password.
              </motion.p>

              {success ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 pt-8 pb-4">
                  <div className="mx-auto w-24 h-24 mb-6 bg-[#10B981]/10 rounded-full flex items-center justify-center">
                    <MailCheck className="text-[#10B981] w-12 h-12" strokeWidth={2} />
                  </div>
                  <h3 className="font-bold text-xl text-[#10B981]">Password updated!</h3>
                  <p className="text-[#6B7280] px-4">Your password has been changed successfully. Redirecting you to the dashboard...</p>
                  <Link href="/dashboard" className="inline-flex justify-center items-center py-3 px-6 rounded-full text-white font-semibold mt-4 bg-gradient-to-r from-[#6C5CE7] to-[#5B4FE5] hover:opacity-90 transition-opacity shadow-sm">
                    Go to Dashboard
                  </Link>
                </motion.div>
              ) : (
                <div className="space-y-5 lg:space-y-6">
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] px-4 py-3 rounded-lg bg-red-50 text-red-600 border border-red-100">
                      {error}
                    </motion.div>
                  )}
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <motion.div variants={itemVariants}>
                      <FloatingInput 
                        id="update-password" 
                        label="New password"
                        type="password" 
                        required 
                        minLength={8}
                        autoComplete="new-password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        icon={<Lock size={18} strokeWidth={1.5} />}
                      />
                    </motion.div>

                    <motion.button 
                      variants={itemVariants}
                      whileHover={{ scale: 1.01, boxShadow: "0 6px 20px rgba(108,92,231,0.23)", transition: { duration: 0.2 } }}
                      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
                      id="update-submit" 
                      type="submit" 
                      disabled={loading} 
                      className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-full text-[15px] text-white font-semibold transition-all disabled:opacity-70 mt-6 md:mt-4 bg-[#5742FF] hover:bg-[#4E3BE5] shadow-[0_4px_14px_0_rgba(108,92,231,0.25)]"
                    >
                      {loading ? "Updating..." : "Update password"}
                    </motion.button>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
      </div>
    </div>
  );
}
