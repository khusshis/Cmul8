"use client";

import React from "react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";

const coreNodes = [
  { icon: "⬢", name: "Source (Generator)", desc: "Generate entities at defined intervals with configurable distributions." },
  { icon: "⬢", name: "Service / Delay", desc: "Time-consuming activities with variable processing durations." },
  { icon: "⬢", name: "Resource (Capacity)", desc: "Limited staff or machines with configurable capacity." },
  { icon: "⬢", name: "Queue (Buffer)", desc: "Waiting areas with FIFO, LIFO, or priority disciplines." },
  { icon: "⬢", name: "Decision (Router)", desc: "Route entities by probability, condition, or round-robin logic." },
  { icon: "⬢", name: "Sink (Termination)", desc: "Collect entities and calculate final KPIs automatically." },
];

const advancedNodes = [
  { icon: "⚡", name: "Priority Resource", desc: "High-priority entities bypass standard waiting lines." },
  { icon: "⚡", name: "Preemptive Resource", desc: "Critical processes interrupt lower-priority tasks mid-service." },
  { icon: "⚡", name: "Wait with Timeout (Renege)", desc: "Entities exit if maximum wait time is exceeded." },
  { icon: "⚡", name: "Container / Level", desc: "Manage flowable substances like fuel or raw material." },
  { icon: "⚡", name: "Event Trigger / Condition", desc: "React to state changes or schedule future events dynamically." },
  { icon: "⚡", name: "Store / Pipe", desc: "Async process communication for decoupled parallel flows." },
];

function NodeItem({ icon, name, desc, delay, color }: { icon: string; name: string; desc: string; delay: number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-start gap-3 group"
    >
      <span
        className="text-xl mt-0.5 flex-shrink-0"
        style={{ color, filter: `drop-shadow(0 0 6px ${color})` }}
      >
        {icon}
      </span>
      <div>
        <p
          className="font-semibold text-sm text-white"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {name}
        </p>
        <p
          className="text-xs mt-0.5 leading-relaxed"
          style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
        >
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

export default function FeaturesSection() {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      id="features"
      ref={ref}
      className="relative py-24 px-4"
      style={{ background: "transparent" }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <span className="section-label">SIMULATION TOOLKIT</span>
        </motion.div>

        {/* Heading */}
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
              textShadow: "0 0 20px rgba(0,242,255,0.3)",
            }}
          >
            MODEL ANYTHING. CODE NOTHING.
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center max-w-2xl mx-auto mb-14 text-lg"
          style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
        >
          The core of JustCmul8 is a 2D drag-and-drop workspace powered by React Flow,
          enabling anyone — the &ldquo;Citizen Modeler&rdquo; — to build a rigorous system model.
        </motion.p>

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Core Primitives — 2/5 width */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-2 glass-panel hover-glow-cyan p-6 space-y-5"
          >
            <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid rgba(0,242,255,0.1)" }}>
              <span
                className="text-xs font-semibold tracking-widest text-neon-green uppercase"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                CORE PRIMITIVES
              </span>
            </div>
            <div className="space-y-4">
              {coreNodes.map((n, i) => (
                <NodeItem key={n.name} {...n} delay={0.35 + i * 0.08} color="var(--neon-green)" />
              ))}
            </div>
          </motion.div>

          {/* Advanced Logic — 3/5 width */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-3 glass-panel hover-glow-cyan p-6 space-y-5"
          >
            <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid rgba(0,242,255,0.1)" }}>
              <span
                className="text-xs font-semibold tracking-widest text-neon-yellow uppercase"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                ADVANCED LOGIC NODES
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {advancedNodes.map((n, i) => (
                <NodeItem key={n.name} {...n} delay={0.45 + i * 0.08} color="var(--neon-yellow)" />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
