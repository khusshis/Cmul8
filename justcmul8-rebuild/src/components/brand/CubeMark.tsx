"use client";

import { motion } from "framer-motion";

export const MARK_SRC = "/brand/logo-mark.webp";
export const TEXT_SRC = "/brand/logo-text.webp";
export const MARK_RATIO = 452 / 539; // width / height of the cube mark
export const TEXT_RATIO = 640 / 182; // width / height of the wordmark + tagline

/**
 * Damped spring described by angular frequency `w` (rad/s) and damping ratio `z`,
 * the parametrisation used by Barty-Bart/motion-graphics and our landing showreel
 * (motion/showreel/scene.html). With mass 1: stiffness = w², damping = 2·z·w.
 * z < 1 overshoots a little (lively), z ≈ 0.8–1 settles cleanly (premium, calm).
 */
export const spring = (w: number, z: number, delay = 0) => ({
  type: "spring" as const,
  stiffness: w * w,
  damping: 2 * z * w,
  mass: 1,
  delay,
});

// Smooth in-out (quint-like) used for draws and wipes.
export const EASE_IO = [0.65, 0, 0.35, 1] as const;
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// The real logo cut into its three cube faces (same polygons as the showreel).
const FACES = [
  "50% 0%,100% 23.56%,50% 46.01%,0% 23.75%", // top
  "0% 23.75%,50% 46.01%,50% 100%,0% 100%", // left
  "50% 46.01%,100% 23.56%,100% 100%,50% 100%", // right
];
// Where each face flies in from, as a fraction of the mark size, plus its starting rotation.
const FACE_FROM: [number, number, number][] = [
  [0, -1.05, -35],
  [-1.0, 0.6, 28],
  [1.0, 0.6, -28],
];

/**
 * The JustCmul8 cube mark, built from its three faces.
 * - "assemble": faces fly in and lock together, then the untouched logo crossfades in (no seams).
 * - "breathe": faces assemble, then gently separate and rejoin in a loop (loading state).
 */
export function CubeMark({
  mode,
  delay = 0,
  className = "",
  style,
}: {
  mode: "assemble" | "breathe";
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: `${MARK_RATIO}`, ...style }}>
      {FACES.map((poly, i) => {
        const [fx, fy, rot] = FACE_FROM[i];
        const t0 = delay + i * 0.07;
        return (
          // Outer layer: the idle "breathing" drift (starts after the face has landed).
          <motion.div
            key={i}
            className="absolute inset-0"
            animate={mode === "breathe" ? { x: ["0%", `${fx * 7}%`, "0%"], y: ["0%", `${fy * 7}%`, "0%"] } : undefined}
            transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, delay: t0 + 0.9 }}
          >
            {/* Inner layer: the fly-in and lock. */}
            <motion.img
              src={MARK_SRC}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 w-full h-full select-none"
              style={{ clipPath: `polygon(${poly})` }}
              initial={{ x: `${fx * 100}%`, y: `${fy * 100}%`, rotate: rot, opacity: 0, filter: "blur(10px)" }}
              animate={{ x: "0%", y: "0%", rotate: 0, opacity: 1, filter: "blur(0px)" }}
              transition={{
                default: spring(12, 0.62, t0),
                opacity: { duration: 0.3, delay: t0 },
                filter: { duration: 0.45, delay: t0 },
              }}
            />
          </motion.div>
        );
      })}
      {mode === "assemble" && (
        <motion.img
          src={MARK_SRC}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 w-full h-full select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: delay + 0.55 }}
        />
      )}
    </div>
  );
}
