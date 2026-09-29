"use client";

import { useEffect, useRef, useState } from "react";
import { MARK_SRC, TEXT_SRC, TEXT_RATIO } from "@/components/brand/CubeMark";

/*
 * Boot sequence. A blueprint of the cube is drawn like a simulation graph (nodes + edges,
 * entities flowing into the centre node), the real logo's three faces fly in and lock onto
 * it, the wordmark unrolls beside it, then an iris opens from the logo to reveal the app.
 *
 * Pure CSS on purpose: it starts at first paint, so it plays smoothly even while a heavy
 * page (dashboard, workspace) is still downloading/hydrating its JavaScript. JS only
 * unmounts it afterwards. Plays on every full load; client navigation never replays it.
 */
const T = {
  wire: 0.1,
  flow: 0.5,
  spark: 0.86,
  faces: 0.78,
  wireOut: 1.02,
  shine: 1.35,
  word: 1.4,
  exit: 2.35,
  done: 3.05,
};

/**
 * Closed-form damped spring (the step response used by Barty-Bart/motion-graphics and our
 * landing showreel), sampled into a CSS linear() easing. w = angular frequency, z = damping ratio.
 */
function springCss(w: number, z: number) {
  const dur = Math.log(500) / (z * w); // until the envelope is within 0.2% of rest
  const wd = w * Math.sqrt(1 - z * z);
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * dur;
    const v = i === 48 ? 1 : 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
    pts.push(v.toFixed(4));
  }
  return { ease: `linear(${pts.join(",")})`, dur: +dur.toFixed(3) };
}
const LAND = springCss(12, 0.62); // faces lock with a small overshoot
const POP = springCss(18, 0.5); // blueprint nodes
const UNROLL = springCss(10, 0.9); // wordmark, calm

// Cube blueprint in the mark's own pixel space (logo-mark is 452 × 539).
const V = { T: [226, 8], RT: [444, 128], RB: [444, 410], B: [226, 530], LB: [8, 410], LT: [8, 128], C: [226, 240] } as const;
const OUTLINE = `M${V.T} L${V.RT} L${V.RB} L${V.B} L${V.LB} L${V.LT} Z`;
const SPOKES = `M${V.LT} L${V.C} L${V.RT} M${V.C} L${V.B}`;
const NODES = [V.T, V.RT, V.RB, V.B, V.LB, V.LT];
const ENTITIES = [V.LT, V.RT, V.B];
const FACES = [
  { poly: "50% 0%,100% 23.56%,50% 46.01%,0% 23.75%", from: "0%,-105%", rot: -35 },
  { poly: "0% 23.75%,50% 46.01%,50% 100%,0% 100%", from: "-100%,60%", rot: 28 },
  { poly: "50% 46.01%,100% 23.56%,100% 100%,50% 100%", from: "100%,60%", rot: -28 },
];

const IO = "cubic-bezier(.65,0,.35,1)";
const OUT = "cubic-bezier(.22,1,.36,1)";

const CSS = `
@property --jc8-iris { syntax: "<length>"; inherits: false; initial-value: 0px; }
.jc8-splash {
  --mh: clamp(76px, 20vw, 132px);
  mask-image: radial-gradient(circle at 50% 50%, transparent var(--jc8-iris), #000 calc(var(--jc8-iris) + 1.5px));
  -webkit-mask-image: radial-gradient(circle at 50% 50%, transparent var(--jc8-iris), #000 calc(var(--jc8-iris) + 1.5px));
  animation: jc8-iris .75s ${T.exit + 0.12}s both, jc8-off 1ms ${T.exit}s both, jc8-gone .3s ${T.done - 0.3}s both;
  animation-timing-function: cubic-bezier(.76,0,.24,1), linear, linear;
}
@keyframes jc8-iris { to { --jc8-iris: 75vmax; } }
@keyframes jc8-off { to { pointer-events: none; } }
@keyframes jc8-gone { to { opacity: 0; visibility: hidden; } }

.jc8-grid { animation: jc8-grid 1.4s ${OUT} both; }
@keyframes jc8-grid { from { opacity: 0; transform: scale(1.08); } }
.jc8-orb-a { animation: jc8-drift-a 6s ease-in-out infinite; }
.jc8-orb-b { animation: jc8-drift-b 7s ease-in-out infinite; }
@keyframes jc8-drift-a { 50% { transform: translate(60px, 40px); } }
@keyframes jc8-drift-b { 50% { transform: translate(-50px, -30px); } }

.jc8-lockup { animation: jc8-lift .4s ${T.exit}s ${OUT} both; }
@keyframes jc8-lift { to { transform: scale(1.06); opacity: 0; filter: blur(6px); } }

.jc8-glow { animation: jc8-glow 1.1s ${T.faces + 0.2}s ${OUT} both; }
@keyframes jc8-glow { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.5); } 35% { opacity: 1; transform: translate(-50%,-50%) scale(1.15); } 100% { opacity: .55; transform: translate(-50%,-50%) scale(1); } }

.jc8-wire { animation: jc8-fade-out .3s ${T.wireOut}s both; }
@keyframes jc8-fade-out { to { opacity: 0; } }
.jc8-draw { stroke-dasharray: 1; animation: jc8-draw .62s ${IO} both; }
@keyframes jc8-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
.jc8-node { transform-box: fill-box; transform-origin: center; animation: jc8-pop ${POP.dur}s both; animation-timing-function: ${POP.ease}; }
@keyframes jc8-pop { from { transform: scale(0); } }
.jc8-entity { animation: jc8-flow .4s both; }
@keyframes jc8-flow { 0% { opacity: 0; transform: var(--from); animation-timing-function: cubic-bezier(.5,0,.9,.4); } 15% { opacity: 1; } 85% { opacity: 1; } 90% { transform: none; } 100% { opacity: 0; transform: none; } }
.jc8-spark { transform-box: fill-box; transform-origin: center; animation: jc8-spark .55s ${T.spark}s ${OUT} both; }
@keyframes jc8-spark { from { transform: scale(0); opacity: 1; } to { transform: scale(1); opacity: 0; } }

.jc8-face {
  animation: jc8-land ${LAND.dur}s both, jc8-sharpen .45s both;
  animation-timing-function: ${LAND.ease}, ${OUT};
}
@keyframes jc8-land { from { transform: translate(var(--from)) rotate(var(--rot)); } }
@keyframes jc8-sharpen { from { opacity: 0; filter: blur(10px); } }
.jc8-full { animation: jc8-fade-in .2s ${T.faces + 0.55}s both; }
@keyframes jc8-fade-in { from { opacity: 0; } }

.jc8-shine { animation: jc8-shine .7s ${T.shine}s ${IO} both; }
@keyframes jc8-shine { from { left: -60%; } to { left: 130%; } }

.jc8-word { width: calc(var(--mh) * ${(0.56 * TEXT_RATIO + 0.2).toFixed(3)}); animation: jc8-unroll ${UNROLL.dur}s ${T.word}s both; animation-timing-function: ${UNROLL.ease}; }
@keyframes jc8-unroll { from { width: 0; } }
.jc8-word img { animation: jc8-word-in .6s ${T.word + 0.08}s ${OUT} both; }
@keyframes jc8-word-in { from { transform: translateX(-24px); opacity: 0; filter: blur(8px); } }

@media (prefers-reduced-motion: reduce) {
  .jc8-splash, .jc8-splash * { animation-duration: 1ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; }
}
`;

/** Seconds until the boot splash starts revealing the page (0 when it isn't on screen). */
export function splashRevealDelay() {
  if (typeof document === "undefined") return 0;
  const a = document
    .querySelector(".jc8-splash")
    ?.getAnimations()
    .find((x) => (x as CSSAnimation).animationName === "jc8-gone");
  return typeof a?.currentTime === "number" ? Math.max(0, T.exit - a.currentTime / 1000) : 0;
}

export default function SplashScreen() {
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The CSS timeline started at first paint (maybe long before hydration): unmount when its
    // final animation actually finishes rather than guessing with a timer.
    const last = ref.current?.getAnimations?.().find((a) => (a as CSSAnimation).animationName === "jc8-gone");
    const elapsed = typeof last?.currentTime === "number" ? last.currentTime : 0;
    const t = setTimeout(() => setDone(true), Math.max(0, T.done * 1000 - elapsed) + 50);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;

  return (
    <div ref={ref} aria-hidden className="jc8-splash fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-[#fafaff] select-none">
      <style>{CSS}</style>
      <link rel="preload" as="image" href={MARK_SRC} />
      <link rel="preload" as="image" href={TEXT_SRC} />

      {/* Ambient: dot grid + two drifting colour orbs */}
      <div
        className="jc8-grid absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(99,102,241,.2) 1.3px, transparent 1.8px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse 55% 55% at 50% 50%, #000 15%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 55% 55% at 50% 50%, #000 15%, transparent 80%)",
        }}
      />
      <div className="jc8-orb-a absolute w-[70vmax] h-[70vmax] rounded-full" style={{ background: "radial-gradient(circle, #ddd3ff 0%, transparent 62%)", left: "-30vmax", top: "-35vmax" }} />
      <div className="jc8-orb-b absolute w-[60vmax] h-[60vmax] rounded-full opacity-70" style={{ background: "radial-gradient(circle, #e7d9ff 0%, transparent 62%)", right: "-28vmax", bottom: "-32vmax" }} />

      {/* Lockup: [mark][wordmark]. The wordmark column grows from 0 width, so the mark glides left and the pair stays centred. */}
      <div className="jc8-lockup relative flex items-center">
        <div className="relative" style={{ height: "var(--mh)", aspectRatio: "452 / 539" }}>
          <div
            className="jc8-glow absolute left-1/2 top-1/2 w-[260%] aspect-square rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(87,66,255,.42), rgba(139,92,246,.16) 42%, transparent 68%)" }}
          />

          {/* Blueprint: the cube drawn as a graph, then handed over to the real logo */}
          <svg viewBox="0 0 452 539" className="jc8-wire absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <linearGradient id="jc8-wire-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#5742FF" />
              </linearGradient>
            </defs>
            {[OUTLINE, SPOKES].map((d, i) => (
              <path
                key={d}
                d={d}
                pathLength={1}
                className="jc8-draw"
                style={{ animationDelay: `${T.wire + i * 0.12}s` }}
                fill="none"
                stroke="url(#jc8-wire-grad)"
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {NODES.map(([cx, cy], i) => (
              <circle
                key={i}
                className="jc8-node"
                style={{ animationDelay: `${T.wire + 0.08 + i * 0.06}s` }}
                cx={cx}
                cy={cy}
                r={17}
                fill="#fff"
                stroke="#5742FF"
                strokeWidth={8}
              />
            ))}
            {ENTITIES.map(([x, y], i) => (
              <circle
                key={i}
                className="jc8-entity"
                style={{ animationDelay: `${T.flow + i * 0.04}s`, ["--from" as string]: `translate(${x - V.C[0]}px, ${y - V.C[1]}px)` }}
                cx={V.C[0]}
                cy={V.C[1]}
                r={13}
                fill="#8b5cf6"
              />
            ))}
            <circle className="jc8-spark" cx={V.C[0]} cy={V.C[1]} r={170} fill="none" stroke="#8b5cf6" strokeWidth={6} />
          </svg>

          {/* The real logo, assembled from its three faces, then the untouched image on top (no seams) */}
          {FACES.map((f, i) => (
            <img
              key={i}
              src={MARK_SRC}
              alt=""
              draggable={false}
              className="jc8-face absolute inset-0 w-full h-full"
              style={{
                clipPath: `polygon(${f.poly})`,
                animationDelay: `${T.faces + i * 0.07}s, ${T.faces + i * 0.07}s`,
                ["--from" as string]: f.from,
                ["--rot" as string]: `${f.rot}deg`,
              }}
            />
          ))}
          <img src={MARK_SRC} alt="" draggable={false} className="jc8-full absolute inset-0 w-full h-full" />

          {/* Light sweep across the finished mark, masked to the logo's own shape */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ maskImage: `url(${MARK_SRC})`, WebkitMaskImage: `url(${MARK_SRC})`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
          >
            <div
              className="jc8-shine absolute -top-1/4 -bottom-1/4 w-1/2"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)", transform: "skewX(-18deg)" }}
            />
          </div>
        </div>

        {/* Wordmark + tagline unroll */}
        <div className="jc8-word overflow-hidden">
          <img
            src={TEXT_SRC}
            alt=""
            draggable={false}
            className="max-w-none"
            style={{ height: "calc(var(--mh) * 0.56)", aspectRatio: `${TEXT_RATIO}`, marginLeft: "calc(var(--mh) * 0.2)" }}
          />
        </div>
      </div>
    </div>
  );
}
