"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Our only vertical scrollbar. Native ones are hidden (some Chrome builds draw their overlay
 * scrollbar on top of a styled one), so this draws a slim brand-coloured thumb that tracks the
 * scroll position and can be dragged or clicked like a normal scrollbar.
 *
 * Without `target` it scrolls the page (fixed to the viewport edge). With `target` it scrolls
 * that element: give the element `no-scrollbar` and put this in a `relative` wrapper around it.
 */
export default function PageScrollbar({ target }: { target?: React.RefObject<HTMLElement | null> }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; scroll: number } | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const [active, setActive] = useState(false); // widened: hovering or dragging

  // Scroll metrics for the page or the target element.
  const metrics = () => {
    const el = target?.current;
    return el
      ? { view: el.clientHeight, total: el.scrollHeight, top: el.scrollTop }
      : { view: window.innerHeight, total: document.documentElement.scrollHeight, top: window.scrollY };
  };
  const scrollTo = (top: number, smooth = false) =>
    (target?.current ?? window).scrollTo({ top, behavior: smooth ? "smooth" : "auto" });

  useEffect(() => {
    const el = target?.current;
    let raf = 0;
    // Size + position the thumb straight on the DOM (no React re-render per scroll frame).
    const update = () => {
      raf = 0;
      const track = trackRef.current;
      const thumb = thumbRef.current;
      if (!track || !thumb) return;
      const { view, total, top } = metrics();
      const canScroll = total > view + 1;
      setScrollable((s) => (s === canScroll ? s : canScroll));
      if (!canScroll) return;
      const th = track.clientHeight;
      const h = Math.max(40, (view / total) * th);
      const y = (top / (total - view)) * (th - h);
      thumb.style.height = `${h}px`;
      thumb.style.transform = `translate3d(0, ${y}px, 0)`;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    const scroller = el ?? window;
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Content height changes (lazy sections, route changes, swapped steps).
    const ro = new ResizeObserver(schedule);
    ro.observe(el ?? document.body);
    if (el) Array.from(el.children).forEach((c) => ro.observe(c));
    const mo = el ? new MutationObserver(() => { Array.from(el.children).forEach((c) => ro.observe(c)); schedule(); }) : null;
    mo?.observe(el!, { childList: true, subtree: true });
    return () => {
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      mo?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert a pointer delta on the track into a scroll delta.
  const ratio = () => {
    const { view, total } = metrics();
    return (total - view) / Math.max(1, trackRef.current!.clientHeight - thumbRef.current!.offsetHeight);
  };

  if (!scrollable) return <div ref={trackRef} className="hidden" aria-hidden><div ref={thumbRef} /></div>;

  return (
    <div
      ref={trackRef}
      aria-hidden
      className={`${target ? "absolute right-0 top-1 bottom-1 z-20" : "fixed right-0.5 top-1.5 bottom-1.5 z-[90]"} w-3 flex justify-end`}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => { if (!drag.current) setActive(false); }}
      onPointerDown={(e) => {
        // Click on the empty track: jump so the thumb centres on the pointer.
        if (e.target !== e.currentTarget) return;
        const thumb = thumbRef.current!;
        const rect = e.currentTarget.getBoundingClientRect();
        scrollTo((e.clientY - rect.top - thumb.offsetHeight / 2) * ratio(), true);
      }}
    >
      <div
        ref={thumbRef}
        className={`absolute right-0 top-0 rounded-full bg-gradient-to-b from-[#a78bfa] to-[#5742ff] cursor-grab active:cursor-grabbing transition-[width,opacity] duration-200 ${active ? "w-2 opacity-100" : "w-1.5 opacity-70"}`}
        style={{ willChange: "transform" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, scroll: metrics().top };
          setActive(true);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          scrollTo(drag.current.scroll + (e.clientY - drag.current.y) * ratio());
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
