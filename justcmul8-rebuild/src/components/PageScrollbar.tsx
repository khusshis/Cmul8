"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * The page's only vertical scrollbar. The native one is hidden in globals.css (some Chrome builds
 * draw their overlay scrollbar on top of a styled one), so this draws a slim brand-coloured thumb
 * that tracks the scroll position and can be dragged or clicked like a normal scrollbar.
 */
export default function PageScrollbar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; scroll: number } | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const [active, setActive] = useState(false); // widened: hovering or dragging

  useEffect(() => {
    const doc = document.documentElement;
    let raf = 0;
    // Size + position the thumb straight on the DOM (no React re-render per scroll frame).
    const update = () => {
      raf = 0;
      const track = trackRef.current;
      const thumb = thumbRef.current;
      if (!track || !thumb) return;
      const vh = window.innerHeight;
      const total = doc.scrollHeight;
      const canScroll = total > vh + 1;
      setScrollable((s) => (s === canScroll ? s : canScroll));
      if (!canScroll) return;
      const th = track.clientHeight;
      const h = Math.max(40, (vh / total) * th);
      const y = (window.scrollY / (total - vh)) * (th - h);
      thumb.style.height = `${h}px`;
      thumb.style.transform = `translate3d(0, ${y}px, 0)`;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule); // content height changes (lazy sections, route changes)
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Convert a pointer delta on the track into a page scroll delta.
  const ratio = () => {
    const track = trackRef.current!;
    const thumb = thumbRef.current!;
    const doc = document.documentElement;
    return (doc.scrollHeight - window.innerHeight) / Math.max(1, track.clientHeight - thumb.offsetHeight);
  };

  if (!scrollable) return <div ref={trackRef} className="hidden" aria-hidden><div ref={thumbRef} /></div>;

  return (
    <div
      ref={trackRef}
      aria-hidden
      className="fixed right-0.5 top-1.5 bottom-1.5 z-[90] w-3 flex justify-end"
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => { if (!drag.current) setActive(false); }}
      onPointerDown={(e) => {
        // Click on the empty track: jump so the thumb centres on the pointer.
        if (e.target !== e.currentTarget) return;
        const thumb = thumbRef.current!;
        const rect = e.currentTarget.getBoundingClientRect();
        const target = (e.clientY - rect.top - thumb.offsetHeight / 2) * ratio();
        window.scrollTo({ top: target, behavior: "smooth" });
      }}
    >
      <div
        ref={thumbRef}
        className={`absolute right-0 top-0 rounded-full bg-gradient-to-b from-[#a78bfa] to-[#5742ff] cursor-grab active:cursor-grabbing transition-[width,opacity] duration-200 ${active ? "w-2 opacity-100" : "w-1.5 opacity-70"}`}
        style={{ willChange: "transform" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, scroll: window.scrollY };
          setActive(true);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          window.scrollTo({ top: drag.current.scroll + (e.clientY - drag.current.y) * ratio() });
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          drag.current = null;
          setActive(false);
        }}
      />
    </div>
  );
}
