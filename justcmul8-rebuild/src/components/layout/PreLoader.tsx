"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hexagon } from "lucide-react";

interface PreLoaderProps {
  onComplete: () => void;
}

export default function PreLoader({ onComplete }: PreLoaderProps) {
  const [visible, setVisible] = React.useState(true);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += 5;
      setProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setVisible(false);
          onComplete();
        }, 400);
      }
    }, 20); // Fast load for UX
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--color-surface)]"
        >
          <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm px-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center"
            >
              <Hexagon size={48} className="text-[var(--color-accent)] fill-[var(--color-accent-soft)] mb-4" />
              <h1 className="font-bold text-2xl tracking-widest text-[var(--color-text-primary)]">
                JUSTCMUL8
              </h1>
              <p className="text-sm mt-2 text-[var(--color-text-secondary)]">
                Preparing simulation environment...
              </p>
            </motion.div>

            <div className="w-full">
              <div className="w-full h-1 rounded-full bg-[var(--color-surface-sunken)] overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--color-accent)] rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
