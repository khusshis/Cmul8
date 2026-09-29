"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView } from "framer-motion";
import {
  ArrowRight, BadgePercent, Cpu, CreditCard, GraduationCap, Mail, MessageCircle, Plus, Repeat, Share2,
  ShieldCheck, Sparkles, Wand2, type LucideIcon,
} from "lucide-react";
import { Reveal, spring } from "@/components/landing/motionKit";

type QA = { q: string; a: string; icon: LucideIcon };
const CATEGORIES: { id: string; label: string; items: QA[] }[] = [
  {
    id: "general", label: "General",
    items: [
      { icon: Sparkles, q: "What is JustCmul8?", a: "A no-code discrete-event simulation platform. You drag blocks onto a canvas (or describe the system to the AI), run it, and get live KPIs like throughput, utilisation and wait time." },
      { icon: Cpu, q: "Does anything run on my machine?", a: "Everything runs in your browser. The SimPy engine executes via Pyodide (WebAssembly), so there's nothing to install and your models run at full speed locally." },
      { icon: ShieldCheck, q: "Is my data private?", a: "Yes. Projects are isolated per account with row-level security, and everything is encrypted in transit and at rest." },
      { icon: GraduationCap, q: "Who is it for?", a: "Students learning operations research, analysts testing process changes, and teams planning capacity: anyone who wants answers from a model without writing code." },
    ],
  },
  {
    id: "billing", label: "Pricing & billing",
    items: [
      { icon: CreditCard, q: "Do I need a credit card to start?", a: "No. The Free plan is free forever and needs only an email or a Google / GitHub sign-in." },
      { icon: Repeat, q: "Can I switch plans later?", a: "Anytime. Upgrades apply immediately; downgrades take effect at the end of your billing period and your projects stay intact." },
      { icon: GraduationCap, q: "Is there a student discount?", a: "Yes. Students and educators get Pro at a reduced price. Reach out from your academic email and we'll set it up." },
      { icon: BadgePercent, q: "How does yearly billing work?", a: "Pay for 12 months up front and save 20% compared with monthly billing. You can cancel renewal at any time." },
    ],
  },
  {
    id: "product", label: "Product",
    items: [
      { icon: Wand2, q: "Can the AI build a model for me?", a: "Describe your system in plain English (e.g. “an ER with 2 nurses and 3 doctors”) and the Gemini-powered assistant builds the blocks and connections for you." },
      { icon: Share2, q: "Can I share or collaborate on a model?", a: "Share a read-only link with anyone, or invite teammates by email to edit together in real time." },
      { icon: Repeat, q: "Which industries can I simulate?", a: "Human queues, vehicles, liquids and materials, manufacturing, logistics and networks, each with its own animated entities and sprites." },
    ],
  },
];

// Looping mini chat: question → typing dots → answer.
const CHAT = [
  { q: "Can I try it without paying?", a: "Yes! The Free plan is free forever 🎉" },
  { q: "Do I need to install Python?", a: "Nope, it all runs in your browser." },
  { q: "Can the AI build my model?", a: "Just describe it and hit Generate ✨" },
];

function ChatDemo() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [i, setI] = useState(0);
  const [stage, setStage] = useState(0); // 0 question, 1 typing, 2 answer
  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => {
      if (stage < 2) setStage(stage + 1);
      else { setStage(0); setI((i + 1) % CHAT.length); }
    }, stage === 2 ? 2600 : stage === 1 ? 1100 : 700);
    return () => clearTimeout(t);
  }, [stage, i, inView]);
  const c = CHAT[i];
  return (
    <div ref={ref} className="relative flex h-[150px] flex-col justify-end gap-2.5 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`q${i}`}
          layout
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={spring(16, 0.8)}
          className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-white px-3.5 py-2 text-[13px] font-medium text-[#161622] shadow-[0_6px_16px_-8px_rgba(0,0,0,.4)]"
        >
          {c.q}
        </motion.div>
        {stage === 1 && (
          <motion.div key={`t${i}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="self-start flex gap-1 rounded-2xl rounded-bl-md bg-white/20 px-3.5 py-3">
            {[0, 1, 2].map((d) => (
              <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-white" animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.7, repeat: Infinity, delay: d * 0.12 }} />
            ))}
          </motion.div>
        )}
        {stage === 2 && (
          <motion.div
            key={`a${i}`}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={spring(16, 0.8)}
            className="self-start max-w-[85%] rounded-2xl rounded-bl-md bg-[#161622]/35 px-3.5 py-2 text-[13px] font-medium text-white"
          >
            {c.a}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SupportCard() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#7a67ff] via-[#5742FF] to-[#4a36e6] p-7 text-white shadow-[0_40px_80px_-35px_rgba(87,66,255,.7)]">
      <span aria-hidden className="lp-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.12) 1px, transparent 1.5px)", backgroundSize: "18px 18px", maskImage: "linear-gradient(180deg,#000,transparent 70%)", WebkitMaskImage: "linear-gradient(180deg,#000,transparent 70%)" }} />
      <div className="relative">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
          <MessageCircle size={20} />
        </span>
        <h3 className="mt-5 font-space text-[28px] font-bold leading-[1.1] tracking-[-0.03em]">
          Got questions?<br />
          <span className="text-white/75">We&apos;ve got answers.</span>
        </h3>
        <p className="mt-3 text-[14px] leading-relaxed text-white/75">Browse the common ones, or ask us directly. A real person reads every message.</p>

        <div className="mt-6"><ChatDemo /></div>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex -space-x-2">
            {[["A", "#f59e0b"], ["R", "#10b981"], ["S", "#f43f5e"]].map(([l, c]) => (
              <span key={l} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#5742FF] text-[12px] font-bold text-white" style={{ background: c }}>{l}</span>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-white/80">
            <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-300 opacity-70" /><span className="relative h-2 w-2 rounded-full bg-emerald-300" /></span>
            Usually replies within a day
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <a href="mailto:hello@justcmul8.com" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-[#5742FF] shadow-[0_10px_24px_-10px_rgba(0,0,0,.45)] transition-transform hover:scale-[1.02] active:scale-[0.98]">
            <Mail size={16} /> Email us
          </a>
          <Link href="/signup" className="group inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white/10 text-[14px] font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20">
            Start free <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({ item, n, open, onToggle }: { item: QA; n: number; open: boolean; onToggle: () => void }) {
  const Icon = item.icon;
  return (
    <motion.div
      layout
      transition={spring(16, 0.9)}
      className={`group rounded-2xl border bg-white transition-[border-color,box-shadow,background-color] duration-300 ${
        open ? "border-[#c4b5fd] bg-[#fbfaff] shadow-[0_18px_40px_-24px_rgba(87,66,255,.45)]" : "border-[#ecebf7] shadow-[0_1px_2px_rgba(16,24,40,.04)] hover:border-[#dcd8f3] hover:shadow-[0_12px_28px_-20px_rgba(16,24,40,.3)]"
      }`}
    >
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 px-5 py-4 text-left">
        <motion.span
          animate={{ backgroundColor: open ? "#5742FF" : "#f5f3ff", color: open ? "#ffffff" : "#5742FF", rotate: open ? -8 : 0 }}
          transition={spring(16, 0.7)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        >
          <Icon size={18} strokeWidth={2.2} />
        </motion.span>
        <span className="flex-1">
          <span className="block text-[11px] font-bold tabular-nums text-[#b4b1cc]">{String(n).padStart(2, "0")}</span>
          <span className="block text-[15.5px] font-semibold leading-snug text-[#161622]">{item.q}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0, backgroundColor: open ? "#161622" : "#ffffff" }}
          transition={spring(18, 0.8)}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${open ? "border-[#161622] text-white" : "border-[#e7e5f6] text-[#64748b] group-hover:text-[#5742FF]"}`}
        >
          <Plus size={15} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <p className="pb-5 pl-[76px] pr-14 text-[14.5px] leading-relaxed text-[#475569]">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FaqSection() {
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const [open, setOpen] = useState<string | null>(CATEGORIES[0].items[0].q);
  const items = CATEGORIES.find((c) => c.id === cat)!.items;

  return (
    <Reveal className="mx-auto mt-24 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] lg:gap-8" y={24}>
      <SupportCard />

      <div>
        {/* Category tabs */}
        <div className="flex overflow-x-auto no-scrollbar" role="tablist" aria-label="FAQ categories">
          <div className="relative flex h-11 items-center rounded-full bg-black/[0.04] p-1 shadow-[inset_0_1px_2px_rgba(16,24,40,.06)]">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={cat === c.id}
                onClick={() => { setCat(c.id); setOpen(c.items[0].q); }}
                className="relative h-9 whitespace-nowrap rounded-full px-4 text-[13.5px] font-semibold"
              >
                {cat === c.id && <motion.span layoutId="faq-cat-pill" className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_-2px_rgba(16,24,40,.18),inset_0_1px_0_#fff]" transition={spring(20, 0.85)} />}
                <span className={`relative transition-colors ${cat === c.id ? "text-[#161622]" : "text-[#64748b] hover:text-[#161622]"}`}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Questions */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={cat}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-5 flex flex-col gap-3"
          >
            {items.map((it, i) => (
              <QuestionCard key={it.q} item={it} n={i + 1} open={open === it.q} onToggle={() => setOpen(open === it.q ? null : it.q)} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </Reveal>
  );
}
