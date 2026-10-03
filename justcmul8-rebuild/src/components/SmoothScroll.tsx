"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  useEffect(() => {
    // Disable smooth-scroll hijacking on interactive workspace and dashboard routes
    // so trackpad two-finger scroll, mouse wheel, and panel scrolling work 100% natively.
    if (isDashboard) return;

    const lenis = new Lenis({
      // <html> is h-full so it never resizes; watch <body> so the scroll limit grows with pages that load content late.
      content: document.body,
      // Let inner scroll areas (onboarding's question panel, modal bodies) scroll natively instead of Lenis eating the wheel.
      allowNestedScroll: true,
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      touchMultiplier: 2,
    });

    let animationFrameId: number;
    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }

    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
    };
  }, [isDashboard]);

  return <>{children}</>;
}
