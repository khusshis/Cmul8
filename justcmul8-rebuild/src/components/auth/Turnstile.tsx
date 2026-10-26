"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile bot check for sign-up, login and password reset. Inert until
// NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; then enable CAPTCHA (Turnstile) with the secret
// key in Supabase → Authentication → Attack Protection, which verifies the token.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const captchaEnabled = !!SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loading: Promise<void> | null = null;
function loadScript() {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("Turnstile failed to load")); };
    document.head.appendChild(s);
  });
  return loading;
}

/** Renders the widget and reports its token (null when expired). Tokens are single-use:
 *  re-mount it (change its `key`) after each auth attempt to get a fresh one. */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  useEffect(() => { cb.current = onToken; });

  useEffect(() => {
    if (!SITE_KEY) return;
    let id: string | null = null;
    let gone = false;
    loadScript()
      .then(() => {
        if (gone || !el.current || !window.turnstile) return;
        id = window.turnstile.render(el.current, {
          sitekey: SITE_KEY,
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      gone = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={el} className="flex min-h-[65px] justify-center" />;
}
