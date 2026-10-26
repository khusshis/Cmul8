"use client";

import React from "react";
import Link from "next/link";
import { ReactLenis, useLenis } from "lenis/react";
import { MotionConfig, motion } from "framer-motion";
import { ChevronDown, Mail, type LucideIcon } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { spring } from "@/components/landing/motionKit";

export type LegalSection = { id: string; title: string; body: React.ReactNode };
export type LegalHighlight = { icon: LucideIcon; title: string; text: string };

const DOCS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
];

/** Shared layout for /terms and /privacy: switcher, short-version summary, sticky contents, numbered sections. */
export default function LegalPage(props: {
  current: "/terms" | "/privacy";
  title: React.ReactNode;
  intro: string;
  effective: string;
  highlights: LegalHighlight[];
  sections: LegalSection[];
}) {
  return (
    <ReactLenis root>
      <MotionConfig reducedMotion="user">
        <div className="relative min-h-screen bg-bg">
          <Navbar />
          <Body {...props} />
          <Footer />
        </div>
      </MotionConfig>
    </ReactLenis>
  );
}

function Body({ current, title, intro, effective, highlights, sections }: React.ComponentProps<typeof LegalPage>) {
  const lenis = useLenis();
  const [active, setActive] = React.useState(sections[0]?.id);

  // Scroll-spy: the section crossing the upper third of the screen is "current".
  React.useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-20% 0px -70% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -96, duration: 1 });
    else el.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  const contents = (
    <ol className="space-y-0.5">
      {sections.map((s, i) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            onClick={(e) => go(e, s.id)}
            className={`flex gap-3 rounded-xl px-3 py-2 text-[13px] leading-snug transition-colors ${
              active === s.id ? "bg-sf-f3f1ff font-semibold text-fg-5742ff" : "text-fg-64748b hover:bg-ink/[0.04] hover:text-fg-161622"
            }`}
          >
            <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums opacity-70 pt-px">{String(i + 1).padStart(2, "0")}</span>
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <main className="relative">
      {/* Header */}
      <section className="relative overflow-hidden px-4 pb-14 pt-32 md:pb-20 md:pt-40">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(139,92,246,.16),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(99,102,241,.14)_1px,transparent_1.5px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000,transparent_75%)]" />
        <motion.div className="relative mx-auto max-w-3xl text-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring(12, 0.9)}>
          {/* Terms / Privacy switcher */}
          <nav aria-label="Legal documents" className="mx-auto mb-8 inline-flex rounded-full border border-ln-ecebf7 bg-surface/80 p-1 shadow-[0_8px_24px_-14px_rgba(16,24,40,.25)]">
            {DOCS.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                aria-current={d.href === current ? "page" : undefined}
                className={`relative rounded-full px-4 py-2 text-[13px] font-semibold transition-colors sm:px-5 ${d.href === current ? "text-white" : "text-fg-64748b hover:text-fg-161622"}`}
              >
                {d.href === current && <motion.span layoutId="legal-pill" className="absolute inset-0 rounded-full bg-linear-to-b from-sf-6a57ff to-sf-5742ff shadow-[0_6px_16px_-6px_rgba(87,66,255,.7)]" transition={spring(20, 0.85)} />}
                <span className="relative">{d.label}</span>
              </Link>
            ))}
          </nav>
          <h1 className="font-space text-[40px] font-bold leading-[1.05] tracking-[-0.035em] text-fg-161622 sm:text-[56px] md:text-[64px]">{title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-fg-64748b md:text-[17px]">{intro}</p>
          <p className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full bg-ink/[0.035] px-4 py-1.5 text-[12.5px] font-medium text-fg-64748b">
            <span>Effective {effective}</span>
            <span aria-hidden className="hidden h-1 w-1 rounded-full bg-current opacity-40 sm:block" />
            <span>Last updated {effective}</span>
          </p>
        </motion.div>

        {/* The short version */}
        <motion.div
          className="relative mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}
        >
          {highlights.map((h) => (
            <motion.div
              key={h.title}
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: spring(12, 0.85) } }}
              className="rounded-[22px] border border-ln-ecebf7 bg-surface p-5 text-left shadow-[0_1px_2px_rgba(16,24,40,.04),0_18px_40px_-28px_rgba(87,66,255,.35)]"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-sf-f3f1ff text-fg-5742ff">
                <h.icon size={19} strokeWidth={2.1} aria-hidden />
              </span>
              <h2 className="text-[14px] font-bold text-fg-161622">{h.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-64748b">{h.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Contents + sections */}
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-24 lg:grid-cols-[250px_1fr] lg:gap-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <details className="group rounded-[20px] border border-ln-ecebf7 bg-surface p-2 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[13px] font-bold text-fg-161622 [&::-webkit-details-marker]:hidden">
              On this page <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="pt-1">{contents}</div>
          </details>
          <div className="hidden lg:block">
            <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-fg-94a3b8">On this page</p>
            {contents}
          </div>
        </aside>

        <article className="min-w-0">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 border-b border-ln-ecebf7 py-9 first:pt-0 last:border-0">
              <h2 className="flex items-baseline gap-3 font-space text-[22px] font-bold tracking-[-0.02em] text-fg-161622 md:text-[26px]">
                <span className="font-mono text-[13px] font-semibold tabular-nums text-fg-5742ff">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="legal-prose mt-4">{s.body}</div>
            </section>
          ))}

          <div className="mt-10 flex flex-col items-start gap-4 rounded-[24px] border border-ln-e4defd bg-linear-to-br from-sf-f6f4ff to-surface p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
            <div>
              <h2 className="font-space text-[20px] font-bold tracking-[-0.02em] text-fg-161622">Questions about this page?</h2>
              <p className="mt-1 text-[14px] text-fg-64748b">Write to us and a real person will reply, usually within a working day.</p>
            </div>
            <a
              href="mailto:hello@justcmul8.com"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-ln-8d80ff bg-linear-to-b from-sf-6a57ff to-sf-5742ff px-5 text-[14px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(87,66,255,.7)] transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              <Mail size={16} aria-hidden /> hello@justcmul8.com
            </a>
          </div>
        </article>
      </div>
    </main>
  );
}
