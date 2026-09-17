"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

// Global dispatch helper
type ToastListener = (toast: ToastItem) => void;
const listeners: Set<ToastListener> = new Set();

export const toast = {
  show: (message: string, type: ToastType = "info", options?: { title?: string; duration?: number }) => {
    const item: ToastItem = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
      title: options?.title,
      duration: options?.duration ?? 3500,
    };
    listeners.forEach((l) => l(item));
  },
  success: (message: string, title?: string) => toast.show(message, "success", { title }),
  error: (message: string, title?: string) => toast.show(message, "error", { title, duration: 4500 }),
  info: (message: string, title?: string) => toast.show(message, "info", { title }),
  warning: (message: string, title?: string) => toast.show(message, "warning", { title, duration: 4000 }),
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler: ToastListener = (item) => {
      setToasts((prev) => [...prev, item]);
      if (item.duration && item.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== item.id));
        }, item.duration);
      }
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const isSuccess = t.type === "success";
          const isError = t.type === "error";
          const isWarning = t.type === "warning";

          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
              className="pointer-events-auto w-full p-3.5 rounded-2xl bg-white/95 backdrop-blur-md border border-gray-100 shadow-[0_12px_36px_rgba(0,0,0,0.12)] flex items-start gap-3 text-left"
            >
              {/* Icon */}
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  isSuccess
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    : isError
                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                    : isWarning
                    ? "bg-amber-50 text-amber-600 border border-amber-100"
                    : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                }`}
              >
                {isSuccess && <CheckCircle2 size={16} strokeWidth={2.5} />}
                {isError && <AlertCircle size={16} strokeWidth={2.5} />}
                {isWarning && <AlertTriangle size={16} strokeWidth={2.5} />}
                {!isSuccess && !isError && !isWarning && <Info size={16} strokeWidth={2.5} />}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                {t.title && <h4 className="text-[12.5px] font-bold text-gray-900 leading-tight">{t.title}</h4>}
                <p className="text-[12px] text-gray-600 font-medium leading-snug mt-0.5 break-words">{t.message}</p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(t.id)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
