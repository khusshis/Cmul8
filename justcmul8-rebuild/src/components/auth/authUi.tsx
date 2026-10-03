"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { spring, EASE_OUT } from "@/components/brand/CubeMark";
import { splashRevealDelay } from "@/components/SplashScreen";

/** Delay (s) for a form's entrance: after the boot splash if it's still on screen. */
export function useIntroDelay(extra = 0.25) {
  const [d] = useState(() => splashRevealDelay() + extra);
  return d;
}

/** Children rise in one after another. */
export function Stagger({ delay, children, className = "" }: { delay: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function Item({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { ...spring(14, 0.8), filter: { duration: 0.4 } } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function FormTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <Item className="mb-6">
      <h2 className="font-space font-bold text-[26px] leading-tight tracking-[-0.03em] text-[#161622]">{title}</h2>
      <p className="mt-1.5 text-[13.5px] text-[#64748b] leading-relaxed">{sub}</p>
    </Item>
  );
}

/** Gradient pill with a light sweep on hover and a bouncing-dots loading state. */
export function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileHover={loading ? undefined : { y: -1 }}
      whileTap={loading ? undefined : { scale: 0.98 }}
      transition={spring(22, 0.7)}
      className="group relative w-full h-[52px] overflow-hidden rounded-full text-white font-bold text-[15px] bg-gradient-to-r from-[#8b5cf6] to-[#5742FF] border border-[#8d80ff] shadow-[0_12px_30px_-8px_rgba(87,66,255,.55)] hover:shadow-[0_16px_36px_-8px_rgba(87,66,255,.65)] transition-shadow disabled:cursor-wait"
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/45 to-transparent translate-x-0 group-hover:translate-x-[520%] transition-transform duration-700 ease-out" />
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span key="loading" className="flex items-center justify-center gap-1.5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white"
                animate={{ y: [0, -5, 0], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
              />
            ))}
          </motion.span>
        ) : (
          <motion.span key="label" className="flex items-center justify-center gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {children}
            <ArrowRight size={17} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-1" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Error banner that shakes in; re-shakes when the message changes. */
export function FormError({ message }: { message: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key={message}
          role="alert"
          initial={{ opacity: 0, height: 0, x: 0 }}
          animate={{ opacity: 1, height: "auto", x: [0, -8, 7, -5, 3, 0] }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <div className="mb-4 text-[13px] px-4 py-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">{message}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Divider({ label = "or continue with" }: { label?: string }) {
  return (
    <Item className="flex items-center gap-4 my-5">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#e7e5f6]" />
      <span className="text-[12px] font-medium text-[#94a3b8]">{label}</span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#e7e5f6]" />
    </Item>
  );
}

const GOOGLE = (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);
const GITHUB = (
  <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export function OAuthButtons({ onClick }: { onClick: (p: "google" | "github") => void }) {
  return (
    <Item className="grid grid-cols-2 gap-3">
      {([["google", "Google", GOOGLE], ["github", "GitHub", GITHUB]] as const).map(([id, label, icon]) => (
        <motion.button
          key={id}
          type="button"
          onClick={() => onClick(id)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={spring(22, 0.7)}
          className="flex items-center justify-center gap-2.5 h-[48px] rounded-2xl border border-[#e7e5f6] bg-white text-[13.5px] font-bold text-[#161622] hover:border-[#c4b5fd] hover:bg-[#faf8ff] hover:shadow-[0_8px_20px_-10px_rgba(139,92,246,.45)] transition-[border-color,background-color,box-shadow] duration-200"
        >
          {icon} {label}
        </motion.button>
      ))}
    </Item>
  );
}

/** Big animated check + message, for "email sent" / "password updated" states. */
export function SuccessState({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-2">
      <motion.div
        className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#5742FF] flex items-center justify-center shadow-[0_18px_40px_-12px_rgba(87,66,255,.6)] mb-6"
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={spring(12, 0.55)}
      >
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-[#8b5cf6]"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.25 }}
        />
        <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.3 }} />
        </svg>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.35 }}>
        <h2 className="font-space font-bold text-[26px] tracking-[-0.03em] text-[#161622]">{title}</h2>
        <div className="mt-2 text-[13.5px] text-[#64748b] leading-relaxed">{children}</div>
        {action && <div className="mt-6">{action}</div>}
      </motion.div>
    </div>
  );
}

// 0–4: length ≥ 8, mixed case, a digit, a symbol.
function strength(pw: string) {
  if (!pw) return 0;
  return [pw.length >= 8, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
}
const LEVELS = [
  { label: "Too short", color: "#e2e8f0" },
  { label: "Weak", color: "#f43f5e" },
  { label: "Fair", color: "#f59e0b" },
  { label: "Good", color: "#8b5cf6" },
  { label: "Strong", color: "#12a150" },
];

export function StrengthMeter({ password }: { password: string }) {
  const score = strength(password);
  const level = LEVELS[score];
  return (
    <AnimatePresence initial={false}>
      {password && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 pt-2.5 px-1">
            <div className="flex-1 grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-1.5 rounded-full bg-[#eeedf7] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full origin-left"
                    style={{ background: level.color }}
                    animate={{ scaleX: score >= i ? 1 : 0 }}
                    transition={spring(16, 0.8, (i - 1) * 0.04)}
                  />
                </div>
              ))}
            </div>
            <span className="w-16 text-right text-[11.5px] font-bold transition-colors" style={{ color: score ? level.color : "#94a3b8" }}>
              {level.label}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
