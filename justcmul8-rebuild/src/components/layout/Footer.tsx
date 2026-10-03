"use client";

import React from "react";
import Link from "next/link";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { useLenis } from "lenis/react";
import { ArrowRight, ArrowUp, Mail } from "lucide-react";
import { MARK_SRC } from "@/components/brand/CubeMark";
import { SplitWords, VIEW, spring, EASE_OUT } from "@/components/landing/motionKit";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "AI Engine", href: "/#ai" },
      { label: "Simulation Engine", href: "/#engine" },
      { label: "Simulation Types", href: "/#simulations" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Sign up", href: "/signup" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Reset password", href: "/forgot-password" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Security", href: "/#security" },
      { label: "Contact", href: "mailto:hello@justcmul8.com" },
    ],
  },
];

const GITHUB = (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor" aria-hidden>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);
const X_ICON = (
  <svg viewBox="0 0 24 24" className="w-[16px] h-[16px]" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// A button that leans toward the cursor.
function Magnetic({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const x = useSpring(0, { stiffness: 220, damping: 18 });
  const y = useSpring(0, { stiffness: 220, damping: 18 });
  return (
    <motion.div
      className={className}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.25);
        y.set((e.clientY - r.top - r.height / 2) * 0.35);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

// Dark call-to-action panel with a spotlight that follows the cursor.
function CtaPanel() {
  const mx = useMotionValue(70);
  const my = useMotionValue(20);
  const spot = useMotionTemplate`radial-gradient(520px circle at ${mx}% ${my}%, rgba(139,92,246,.35), transparent 60%)`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={VIEW}
      transition={spring(9, 0.9)}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 100);
        my.set(((e.clientY - r.top) / r.height) * 100);
      }}
      className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-[#161622] text-white px-6 py-14 sm:px-12 md:px-16 md:py-20"
    >
      <motion.div aria-hidden className="absolute inset-0" style={{ background: spot }} />
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(196,181,253,.18) 1.2px, transparent 1.7px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 80% 70% at 70% 30%, #000 10%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 70% 30%, #000 10%, transparent 75%)",
        }}
      />
      <motion.img
        src={MARK_SRC}
        alt=""
        aria-hidden
        className="absolute -right-10 -bottom-16 w-[260px] md:w-[360px] opacity-[0.12] pointer-events-none select-none"
        initial={{ rotate: -20, y: 60 }}
        whileInView={{ rotate: -8, y: 0 }}
        viewport={VIEW}
        transition={spring(6, 0.8, 0.2)}
      />

      <div className="relative max-w-2xl">
        <h2 className="font-space font-bold text-[2.25rem] leading-[1.05] sm:text-[3rem] md:text-[3.75rem] tracking-[-0.035em]">
          <SplitWords text="Your next system," accent="simulated in minutes." />
        </h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEW}
          transition={{ duration: 0.6, delay: 0.35, ease: EASE_OUT }}
          className="mt-5 text-[15px] md:text-[17px] text-white/65 leading-relaxed max-w-xl"
        >
          Drag, connect and run. Or just describe it and let the AI build the model for you — no code, no install.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEW}
          transition={spring(12, 0.8, 0.45)}
          className="mt-8 flex flex-col sm:flex-row gap-3"
        >
          <Magnetic>
            <Link
              href="/signup"
              className="group relative overflow-hidden inline-flex w-full sm:w-auto items-center justify-center gap-2 h-[52px] px-7 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#5742FF] border border-[#8d80ff] font-bold text-[15px] shadow-[0_14px_36px_-10px_rgba(139,92,246,.8)]"
            >
              <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:translate-x-[620%] transition-transform duration-700 ease-out" />
              Start building free
              <ArrowRight size={17} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Magnetic>
          <Magnetic>
            <Link
              href="/login"
              className="inline-flex w-full sm:w-auto items-center justify-center h-[52px] px-7 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 font-bold text-[15px] transition-colors"
            >
              Log in
            </Link>
          </Magnetic>
        </motion.div>
      </div>
    </motion.div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="group relative inline-flex items-center text-[14px] text-[#64748b] hover:text-[#161622] transition-colors">
      <span className="absolute -left-3 w-1.5 h-1.5 rounded-full bg-[#8b5cf6] scale-0 group-hover:scale-100 transition-transform duration-200" />
      <span className="transition-transform duration-200 group-hover:translate-x-1">{children}</span>
    </a>
  );
}

// Giant wordmark: letters rise in on view; a lilac light follows the cursor across it.
// Giant wordmark in the same type as the section headings: ink "Just", brand-gradient "Cmul8".
// Letters rise in one after another.
// Hover: each letter springs up under the pointer (a small wave as you sweep across),
// "Just" letters tint violet, and the "Cmul8" gradient slowly drifts.
function Wordmark() {
  // Gradient letters each carry their own slice of one 5×-wide gradient (bg-clip on a parent
  // stops painting a child once that child is transformed, which made hovered letters vanish).
  const letter = (l: string, i: number, ink: boolean, slice?: number) => (
    <motion.span
      key={i}
      className={`inline-block ${
        ink
          ? "transition-colors duration-300 hover:text-[#5742FF]"
          : "bg-gradient-to-r from-[#8b5cf6] via-[#5742FF] to-[#8b5cf6] bg-[length:500%_100%] bg-clip-text text-transparent [background-position:var(--p)_50%] transition-[background-position] duration-[1500ms] ease-out group-hover:[background-position:calc(var(--p)+25%)_50%]"
      }`}
      style={slice === undefined ? undefined : ({ ["--p" as string]: `${slice}%` } as React.CSSProperties)}
      variants={{
        hidden: { y: "70%", opacity: 0 },
        show: { y: "0%", opacity: 1, transition: spring(10, 0.75, i * 0.05) },
      }}
      whileHover={{ y: "-10%", transition: spring(18, 0.45) }}
    >
      {l}
    </motion.span>
  );
  return (
    <div className="group relative select-none overflow-hidden pt-[0.1em]" aria-hidden>
      <motion.div
        className="flex justify-center font-space font-bold leading-[0.9] tracking-[-0.035em] text-[21vw] xl:text-[16rem] pb-[0.08em]"
        initial="hidden"
        whileInView="show"
        viewport={VIEW}
      >
        <span className="text-[#161622]">{"Just".split("").map((l, i) => letter(l, i, true))}</span>
        <span>{"Cmul8".split("").map((l, i) => letter(l, i + 4, false, (i / 4) * 100))}</span>
      </motion.div>
    </div>
  );
}

export default function Footer() {
  const lenis = useLenis();
  const toTop = () => (lenis ? lenis.scrollTo(0, { duration: 1.6 }) : window.scrollTo({ top: 0, behavior: "smooth" }));

  return (
    <footer className="relative bg-[#fafaff] pt-16 md:pt-24 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4">
        <CtaPanel />

        <div className="grid grid-cols-2 md:grid-cols-12 gap-x-6 gap-y-10 pt-16 md:pt-20 pb-12">
          <motion.div
            className="col-span-2 md:col-span-5"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEW}
            transition={spring(12, 0.9)}
          >
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <motion.img src={MARK_SRC} alt="" className="h-9 w-auto" whileHover={{ rotate: -12, scale: 1.08 }} transition={spring(14, 0.6)} />
              <span className="flex flex-col">
                <span className="font-space font-bold text-[19px] leading-none tracking-tight text-[#161622] group-hover:text-[#5742FF] transition-colors">JustCmul8</span>
                <span className="text-[11px] font-medium text-[#5742FF] mt-1">Model. Simulate. Optimize.</span>
              </span>
            </Link>
            <p className="mt-5 text-[14px] text-[#64748b] leading-relaxed max-w-sm">
              The no-code discrete event simulation platform. Build, run and analyze models of any system — right in your browser.
            </p>
            <a href="mailto:hello@justcmul8.com" className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-[#161622] hover:text-[#5742FF] transition-colors">
              <Mail size={16} /> hello@justcmul8.com
            </a>
            <div className="mt-6 flex gap-2.5">
              {[
                { label: "GitHub", href: "https://github.com", icon: GITHUB },
                { label: "X (Twitter)", href: "https://x.com", icon: X_ICON },
              ].map((s) => (
                <motion.a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  whileHover={{ y: -3, rotate: -6 }}
                  whileTap={{ scale: 0.92 }}
                  transition={spring(18, 0.6)}
                  className="w-10 h-10 rounded-full bg-white border border-[#ecebf7] text-[#64748b] hover:text-white hover:bg-[#5742FF] hover:border-[#5742FF] flex items-center justify-center transition-colors shadow-[0_6px_16px_-10px_rgba(16,24,40,0.16)]"
                >
                  {s.icon}
                </motion.a>
              ))}
            </div>
          </motion.div>

          {COLUMNS.map((col, ci) => (
            <motion.div
              key={col.title}
              className={ci === 2 ? "col-span-2 sm:col-span-1 md:col-span-2" : "md:col-span-2"}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEW}
              transition={spring(12, 0.9, 0.08 * (ci + 1))}
            >
              <h4 className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#94a3b8] mb-5">{col.title}</h4>
              <ul className="space-y-3.5 pl-3 -ml-3">
                {col.links.map((l) => (
                  <li key={l.label}><FooterLink href={l.href}>{l.label}</FooterLink></li>
                ))}
              </ul>
            </motion.div>
          ))}

          <div className="hidden md:flex md:col-span-1 justify-end items-start">
            <motion.button
              onClick={toTop}
              aria-label="Back to top"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.92 }}
              transition={spring(18, 0.6)}
              className="group w-12 h-12 rounded-full bg-white border border-[#ecebf7] text-[#5742FF] flex items-center justify-center shadow-[0_10px_24px_-12px_rgba(16,24,40,0.16)] hover:bg-[#5742FF] hover:text-white transition-colors"
            >
              <ArrowUp size={18} strokeWidth={2.5} className="transition-transform group-hover:-translate-y-0.5" />
            </motion.button>
          </div>
        </div>
      </div>

      <Wordmark />

      <div className="border-t border-[#ecebf7] bg-white/60">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12.5px] text-[#94a3b8]">
          <span>© {new Date().getFullYear()} JustCmul8. All rights reserved.</span>
          <button onClick={toTop} className="md:hidden inline-flex items-center gap-1.5 font-semibold text-[#5742FF]">
            Back to top <ArrowUp size={14} />
          </button>
          <span className="hidden md:inline">Built for modelers, not coders.</span>
        </div>
      </div>
    </footer>
  );
}
