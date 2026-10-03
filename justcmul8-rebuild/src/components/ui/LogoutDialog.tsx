"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, LogOut } from "lucide-react";
import { spring, EASE_OUT } from "@/components/brand/CubeMark";

/**
 * Sign-out confirmation in the product's own grammar: you are a block on the canvas, and
 * signing out sends you down a link into an Exit node (the same "sink" block the builder uses).
 * Confirming plays the hand-off, then calls `onConfirm`.
 */
export default function LogoutDialog({
  open, onClose, onConfirm, name, email,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  name: string;
  email: string;
}) {
  const [leaving, setLeaving] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    stayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !leaving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, leaving, onClose]);

  async function confirm() {
    setLeaving(true);
    try {
      await new Promise((r) => setTimeout(r, 700)); // let the exit play
      await onConfirm();
    } catch {
      setLeaving(false); // stay on the dialog so the user can retry
    }
  }

  const PATH = "M58 40 C 110 40, 130 40, 182 40";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-[#161622]/35 backdrop-blur-[6px]" onClick={() => !leaving && onClose()} />

          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-desc"
            className="relative w-full max-w-[400px] overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_40px_90px_-30px_rgba(87,66,255,.45),0_12px_30px_-12px_rgba(22,22,34,.25)]"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12, transition: { duration: 0.18 } }}
            transition={spring(14, 0.78)}
          >
            {/* Canvas strip: you → Exit */}
            <div
              className="relative h-[120px] border-b border-[#f1f0fa] bg-[#fbfbff]"
              style={{ backgroundImage: "radial-gradient(rgba(99,102,241,.16) 1.2px, transparent 1.7px)", backgroundSize: "18px 18px" }}
            >
              <svg viewBox="0 0 240 80" className="absolute inset-x-0 top-1/2 mx-auto h-[80px] w-[300px] max-w-full -translate-y-1/2 overflow-visible">
                <motion.path d={PATH} fill="none" stroke="#d9d3fb" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="3 6"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.15 }} />
                {!leaving && [0, 1, 2].map((k) => (
                  <circle key={k} r={3.5} fill="#8b5cf6" stroke="#fff" strokeWidth={1.5} opacity={0}>
                    <animateMotion dur="2.2s" begin={`${k * 0.73}s`} repeatCount="indefinite" path={PATH} />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.85;1" dur="2.2s" begin={`${k * 0.73}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </svg>

              {/* Your block slides down the link into Exit when confirmed */}
              <motion.div
                className="absolute left-1/2 top-1/2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#5742FF] font-space text-[18px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(87,66,255,.8)]"
                style={{ marginLeft: -24, marginTop: -24 }}
                initial={{ x: -96, scale: 0.6, opacity: 0 }}
                animate={leaving ? { x: 96, scale: 0.35, opacity: 0 } : { x: -96, scale: 1, opacity: 1 }}
                transition={leaving ? { duration: 0.6, ease: [0.65, 0, 0.35, 1] } : spring(14, 0.6, 0.1)}
              >
                {initial}
              </motion.div>

              {/* Exit node */}
              <motion.div
                className="absolute left-1/2 top-1/2"
                style={{ marginLeft: 96 - 24, marginTop: -24 }}
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring(14, 0.6, 0.2)}
              >
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ecebf7] bg-white text-[#5742FF] shadow-[0_10px_24px_-12px_rgba(60,50,160,.45)]">
                  <span className="lp-pulse absolute inset-0 rounded-2xl border-2 border-[#5742FF]/25" />
                  <AnimatePresence mode="wait" initial={false}>
                    {leaving ? (
                      <motion.span key="done" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={spring(18, 0.55, 0.15)}>
                        <Check size={20} strokeWidth={3} />
                      </motion.span>
                    ) : (
                      <motion.span key="exit" exit={{ scale: 0, transition: { duration: 0.12 } }}><LogOut size={19} strokeWidth={2.3} /></motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <span className="absolute left-1/2 top-[54px] -translate-x-1/2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#a1a1b5]">Exit</span>
              </motion.div>
            </div>

            <div className="px-6 pb-6 pt-5 text-center">
              <h3 id="logout-title" className="font-space text-[21px] font-bold tracking-[-0.02em] text-[#161622]">
                {leaving ? "Signing you out…" : "Sign out of JustCmul8?"}
              </h3>
              <p id="logout-desc" className="mx-auto mt-1.5 max-w-[300px] text-[13.5px] leading-relaxed text-[#64748b]">
                You&apos;ll be signed out on all your devices. Your simulations and results stay saved.
              </p>
              {email && (
                <span className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-[#ecebf7] bg-[#fafaff] px-3 py-1 text-[12px] font-semibold text-[#475569]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> {email}
                </span>
              )}

              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <button
                  ref={stayRef}
                  onClick={onClose}
                  disabled={leaving}
                  className="h-11 rounded-full border border-[#e7e5f6] bg-white text-[14px] font-semibold text-[#334155] transition-colors hover:border-[#5742FF] hover:text-[#5742FF] disabled:opacity-50"
                >
                  Stay signed in
                </button>
                <motion.button
                  onClick={confirm}
                  disabled={leaving}
                  whileHover={leaving ? undefined : { scale: 1.02 }}
                  whileTap={leaving ? undefined : { scale: 0.97 }}
                  className="group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full bg-[#161622] border border-[#3a3a4c] text-[14px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(22,22,34,.6)] transition-colors hover:bg-[#2a2940] disabled:cursor-wait"
                >
                  {leaving ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} className="transition-transform group-hover:translate-x-0.5" />}
                  {leaving ? "Signing out" : "Sign out"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
