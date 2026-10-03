"use client";
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

// Same look as the dashboard's modals: dark translucent backdrop, 28px card, Space Grotesk title.
export default function Modal({
  open, onClose, title, subtitle, icon, maxWidth = "max-w-md", children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#161622]/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`w-full ${maxWidth} bg-white rounded-[28px] shadow-[0_24px_70px_-12px_rgba(0,0,0,0.3)] relative flex flex-col max-h-[90vh] overflow-hidden`}
          >
            <div className="flex items-start gap-3.5 px-6 sm:px-7 pt-6 sm:pt-7 pb-4">
              {icon && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5f3ff] text-[#5742FF]">{icon}</span>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-space text-[22px] font-bold tracking-[-0.03em] text-[#161622] leading-tight">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[13.5px] text-[#64748b]">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full bg-white p-2 text-[#94a3b8] shadow-sm border border-[#ecebf7] hover:text-[#161622] transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className="px-6 sm:px-7 pb-6 sm:pb-7 overflow-y-auto flex-1 custom-scrollbar">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
