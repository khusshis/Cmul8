"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

// Any page that throws while rendering lands here instead of a blank screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sf-fafaff px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-surface shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <AlertTriangle size={26} className="text-fg-5742ff" />
      </div>
      <h1 className="mb-2 text-[20px] font-extrabold tracking-tight text-fg-111827">Something went wrong</h1>
      <p className="mb-8 max-w-sm text-[13.5px] text-gray-500">
        This page hit an unexpected error. Your saved work is safe. Try again, or head back home.
        {error.digest && <span className="mt-2 block font-mono text-[11.5px] text-gray-400">Reference: {error.digest}</span>}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-full border border-ln-8d80ff bg-sf-5742ff px-5 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-sf-4531e5"
        >
          <RotateCcw size={14} /> Try again
        </button>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-ln-e7e5f6 bg-surface px-5 py-2.5 text-[12.5px] font-bold text-fg-334155 transition-colors hover:border-ln-5742ff hover:text-fg-5742ff"
        >
          <Home size={14} /> Home
        </Link>
      </div>
    </div>
  );
}
