"use client";

import React, { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { spring, EASE_OUT } from "@/components/brand/CubeMark";

// Shared landing motion language (after Barty-Bart/motion-graphics + our showreel):
// springs with at most a tiny overshoot, masked word rises. Only transform + opacity animate (no filters) so it stays at 60fps.
export { spring, EASE_OUT };
// Reveals play both ways: in as a section enters, back out as it leaves.
export const VIEW = { once: false, amount: 0.2 } as const;

/** Fades and rises once when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "p" | "span";
}) {
  const M = motion[as] as typeof motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEW}
      transition={{ ...spring(12, 0.9, delay), opacity: { duration: 0.5, delay } }}
    >
      {children}
    </M>
  );
}

/** Parent that staggers <StaggerItem> children once in view. */
export function Stagger({ children, className = "", gap = 0.07, delay = 0 }: { children: React.ReactNode; className?: string; gap?: number; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={VIEW}
      variants={{ show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: spring(12, 0.85) },
};

export function StaggerItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/** Words rise out of a mask with a small tilt, one after another. `accent` words get the brand gradient. */
export function SplitWords({
  text,
  accent = "",
  className = "",
  delay = 0,
  animateNow = false,
  breakBeforeAccent = true,
}: {
  text: string;
  accent?: string;
  className?: string;
  delay?: number;
  animateNow?: boolean;
  breakBeforeAccent?: boolean;
}) {
  const words = [
    ...text.split(" ").filter(Boolean).map((w) => ({ w, a: false })),
    ...accent.split(" ").filter(Boolean).map((w) => ({ w, a: true })),
  ];
  const breakAt = text.split(" ").filter(Boolean).length;
  const trigger = animateNow ? { animate: "show" } : { whileInView: "show", viewport: VIEW };
  return (
    <motion.span className={className} initial="hidden" {...trigger} aria-label={`${text} ${accent}`.trim()}>
      {words.map(({ w, a }, i) => (
        <React.Fragment key={i}>
          {breakBeforeAccent && accent && i === breakAt && <br />}
          <span aria-hidden className="inline-block overflow-hidden align-bottom pb-[0.14em] -mb-[0.14em] px-[0.02em]">
            <motion.span
              className={`inline-block ${a ? "bg-clip-text text-transparent bg-gradient-to-r from-[#8b5cf6] via-[#5742FF] to-[#6366f1]" : ""}`}
              variants={{
                hidden: { y: "110%", rotate: 6 },
                show: { y: "0%", rotate: 0, transition: spring(13, 0.7, delay + i * 0.06) },
              }}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 && " "}
        </React.Fragment>
      ))}
    </motion.span>
  );
}

/** Eyebrow chip + split headline + subcopy, the header every section shares. */
export function SectionHeader({ title, accent, sub, className = "" }: { title: string; accent: string; sub: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center text-center mb-12 md:mb-16 ${className}`}>
      <h2 className="font-space font-bold text-[2.25rem] leading-[1.06] sm:text-[3rem] md:text-[3.75rem] text-[#161622] tracking-[-0.035em]">
        <SplitWords text={title} accent={accent} delay={0.05} />
      </h2>
      <Reveal delay={0.25} y={12}>
        <p className="mt-5 max-w-2xl text-[15px] sm:text-[1.05rem] md:text-[1.1rem] text-[#64748b] font-medium leading-relaxed px-2">{sub}</p>
      </Reveal>
    </div>
  );
}

/** A small mouse with a rolling wheel + label, hinting that scrolling does something here. */
export function ScrollCue({ label = "Scroll to explore", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-[12px] font-semibold text-[#64748b] ${className}`}>
      <span className="relative h-[26px] w-[17px] shrink-0 rounded-full border-2 border-[#c9c6de]">
        <span className="lp-wheel absolute left-1/2 top-[5px] -ml-[1.5px] h-[6px] w-[3px] rounded-full bg-[#5742FF]" />
      </span>
      {label}
    </div>
  );
}

/** Counts from 0 to `to` once in view. */
export function CountUp({ to, decimals = 0, suffix = "", prefix = "", className = "" }: { to: number; decimals?: number; suffix?: string; prefix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, VIEW);
  const v = useMotionValue(0);
  const text = useTransform(v, (n) => `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    const c = animate(v, to, { duration: 1.4, ease: EASE_OUT });
    return () => c.stop();
  }, [inView, to, v]);
  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

/** Pointer-tracked 3D tilt. Mouse only (touch has no hover). */
export function TiltCard({ children, className = "", max = 6 }: { children: React.ReactNode; className?: string; max?: number }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  // Perspective lives on a wrapper: at rest the card itself has no transform, so its text stays crisp.
  return (
    <div className={className} style={{ perspective: 1000 }}>
      <motion.div
        className="relative h-full rounded-[inherit]"
        style={{ rotateX: rx, rotateY: ry }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          rx.set((0.5 - (e.clientY - r.top) / r.height) * max * 2);
          ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2);
        }}
        onPointerLeave={() => {
          animate(rx, 0, spring(12, 0.8));
          animate(ry, 0, spring(12, 0.8));
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Soft lilac wash + masked dot grid, the landing backdrop. Plain gradients, no blur filters (those cost a repaint per frame). */
export function Backdrop({ tone = "a" }: { tone?: "a" | "b" }) {
  const wash =
    tone === "a"
      ? "radial-gradient(ellipse 45% 40% at 5% 5%, rgba(214,204,255,.45), transparent 70%), radial-gradient(ellipse 40% 40% at 100% 95%, rgba(224,214,255,.5), transparent 70%)"
      : "radial-gradient(ellipse 40% 40% at 100% 30%, rgba(214,204,255,.45), transparent 70%), radial-gradient(ellipse 45% 40% at 0% 100%, rgba(224,214,255,.5), transparent 70%)";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: wash }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(99,102,241,.12) 1.2px, transparent 1.7px)",
          backgroundSize: "30px 30px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 15%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, #000 15%, transparent 80%)",
        }}
      />
    </div>
  );
}
