import Link from "next/link";
import { Compass, Home } from "lucide-react";

// Next's built-in 404 follows prefers-color-scheme, not our .dark class, so it needs a themed page.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-surface shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <Compass size={26} className="text-fg-5742ff" />
      </div>
      <h1 className="mb-2 text-[20px] font-extrabold tracking-tight text-fg-111827">Page not found</h1>
      <p className="mb-8 max-w-sm text-[13.5px] text-gray-500">The page you were looking for doesn&apos;t exist or has moved.</p>
      <Link
        href="/"
        className="flex items-center gap-1.5 rounded-full border border-ln-8d80ff bg-sf-5742ff px-5 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-sf-4531e5"
      >
        <Home size={14} /> Back to home
      </Link>
    </div>
  );
}
