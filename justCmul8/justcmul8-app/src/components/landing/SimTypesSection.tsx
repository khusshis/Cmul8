"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

const simTypes = [
  {
    icon: "🧍",
    name: "HUMAN QUEUE",
    desc: "Bank, Hospital, Airport, Call Center",
    accent: "var(--neon-green)",
    examples: ["Bank tellers", "ER triage", "Passport control"],
  },
  {
    icon: "🚗",
    name: "VEHICLE",
    desc: "Gas Station, Traffic, Drive-Thru",
    accent: "var(--neon-cyan)",
    examples: ["Fuel pumps", "Traffic lights", "Car wash"],
  },
  {
    icon: "💧",
    name: "LIQUID / MATERIAL",
    desc: "Water Treatment, Fuel Tanks, Pipelines",
    accent: "var(--neon-purple)",
    examples: ["Water treatment", "Fuel storage", "Chemical flow"],
  },
  {
    icon: "🏭",
    name: "MANUFACTURING",
    desc: "Assembly Line, QC, Robotic Arms",
    accent: "var(--neon-orange)",
    examples: ["Assembly line", "Quality control", "CNC machining"],
  },
  {
    icon: "📦",
    name: "LOGISTICS",
    desc: "Warehouse, Sorting, Dock Loading",
    accent: "var(--neon-yellow)",
    examples: ["Warehouse ops", "Sort centers", "Dock loading"],
  },
  {
    icon: "📡",
    name: "NETWORK / SIGNAL",
    desc: "Microservices, IoT, Pub/Sub, CDN",
    accent: "var(--neon-magenta)",
    examples: ["Process pipes", "Broadcast fan-out", "Event latency"],
  },
];

export default function SimTypesSection() {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="simulations"
      ref={ref}
      className="relative py-24 px-4"
      style={{ background: "rgba(0,0,0,0.25)" }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <span className="section-label">SIMULATION TYPES</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-4"
        >
          <h2
            className="font-display font-bold text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              letterSpacing: "0.08em",
            }}
          >
            VISUALIZE ANY INDUSTRY
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center max-w-2xl mx-auto mb-14"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--text-secondary)",
            fontSize: "1.1rem",
          }}
        >
          Choose your simulation context. Each type comes with curated 2D sprite
          assets for realistic, animated visualization.
        </motion.p>

        {/* Cards — unified responsive 6-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {simTypes.map((type, i) => (
            <motion.div
              key={type.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
              className="glass-panel p-5 flex flex-col items-center text-center space-y-3 group cursor-pointer"
              style={{ borderTop: `2px solid ${type.accent}` }}
              whileHover={{ scale: 1.03, y: -4 }}
            >
              <span
                className="text-4xl"
                style={{ filter: `drop-shadow(0 0 12px ${type.accent})` }}
              >
                {type.icon}
              </span>
              <h3
                className="font-display font-semibold text-xs tracking-widest text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {type.name}
              </h3>
              <p
                className="text-xs leading-snug"
                style={{
                  fontFamily: "var(--font-body)",
                  color: "var(--text-secondary)",
                }}
              >
                {type.desc}
              </p>
              <ul className="space-y-1 w-full flex-1">
                {type.examples.map((ex) => (
                  <li
                    key={ex}
                    className="text-xs"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-muted)",
                    }}
                  >
                    · {ex}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="text-xs font-semibold tracking-wider transition-colors"
                style={{ color: type.accent, fontFamily: "var(--font-body)" }}
              >
                TRY →
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Extensibility note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.9 }}
          className="text-center text-sm"
          style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}
        >
          + Extensible: More types added regularly.{" "}
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{
              background: "rgba(255,0,255,0.1)",
              border: "1px solid rgba(255,0,255,0.3)",
              color: "var(--neon-magenta)",
            }}
          >
            Custom Types on Pro
          </span>
        </motion.p>
      </div>
    </section>
  );
}
