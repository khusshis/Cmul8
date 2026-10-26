import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Cloudflare Turnstile (sign-up/login bot check) is allowed only once its site key is configured.
const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? " https://challenges.cloudflare.com" : "";

// Supabase REST/Auth (https) and Realtime (wss) for this project only.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host || "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
})();

// Every external host the app really loads (grep for https:// before adding more):
//  (Pyodide and the SimPy wheel are self-hosted under /pyodide, see scripts/copy-pyodide.mjs)
//  - checkout.razorpay.com + *.razorpay.com: Checkout script, iframe and its API calls
//  - fonts.googleapis.com / fonts.gstatic.com: the printable HTML report (reportGenerator.ts)
// 'unsafe-eval' is required by Pyodide's dynamic linker (EM_ASM eval in pyodide.asm.js,
// which also runs under this policy as a worker) and by pixi.js shader sync in the
// Digital Twin. 'unsafe-inline' scripts: Next's inline bootstrap without nonces.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://*.razorpay.com${turnstile}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.razorpay.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://*.razorpay.com data: blob:${isDev ? " ws:" : ""}`,
  `frame-src https://*.razorpay.com${turnstile}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []), // only where it is served over https
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(), usb=(), browsing-topics=(), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
  },
  // allow-popups: Razorpay opens 3-D Secure / UPI windows that report back to the opener.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Share links are capability URLs: keep them out of search engines.
      { source: "/share/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] },
    ];
  },
};

export default nextConfig;
