"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import { Cpu, BarChart3, AlertTriangle, Gauge } from "lucide-react";

const cards = [
  {
    icon: <Cpu size={32} style={{ color: "var(--neon-cyan)" }} />,
    title: "PYODIDE & WEBASSEMBLY",
    description:
      "Full simulation engine runs in-browser via WASM. Zero server costs. Full Python/SimPy execution with no backend required.",
    accent: "var(--neon-cyan)",
  },
  {
    icon: <BarChart3 size={32} style={{ color: "var(--neon-green)" }} />,
    title: "REAL-TIME KPI DASHBOARDS",
    description:
      "📊 Throughput, Utilization, Wait Time, Flow Rate. Live charts update as simulation runs.",
    accent: "var(--neon-green)",
  },
  {
    icon: <AlertTriangle size={32} style={{ color: "var(--neon-red)" }} />,
    title: "BOTTLENECK DETECTION",
    description:
      "Auto-identify the slowest process node in real-time. Red glow highlights bottleneck nodes as simulation progresses.",
    accent: "var(--neon-red)",
  },
  {
    icon: <Gauge size={32} style={{ color: "var(--neon-yellow)" }} />,
    title: "SMART SPEED CONTROL",
    description:
      "Run at 1x, 10x, or maximum speed. Step through events individually or run freely to completion.",
    accent: "var(--neon-yellow)",
  },
];

export default function EngineSection() {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="engine" ref={ref} className="relative py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <span className="section-label">SIMULATION ENGINE</span>
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
            SPEED &amp; PRECISION IN YOUR BROWSER
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center max-w-2xl mx-auto mb-14 text-lg"
          style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
        >
          We bridge the gap between visual design and technical rigor by automatically
          generating and running Python's SimPy logic.
        </motion.p>

        {/* 4 Notched Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.12 }}
              className="glass-panel notched-card hover-glow-cyan p-6 space-y-4 relative"
              style={{ borderLeft: `2px solid ${card.accent}` }}
            >
              {/* Accent corner */}
              <div
                className="absolute top-0 right-0 w-4 h-4"
                style={{ borderTop: `2px solid ${card.accent}`, borderRight: `2px solid ${card.accent}` }}
              />
              <div>{card.icon}</div>
              <h3
                className="font-display font-semibold text-sm tracking-wider text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {card.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
              >
                {card.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
