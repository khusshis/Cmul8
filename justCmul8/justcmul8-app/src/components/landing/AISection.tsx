"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import { CheckCircle } from "lucide-react";

const chatMessages = [
  { role: "user", text: "Create a hospital ER with 2 triage nurses and 3 doctors. Patients arrive every 5 minutes." },
  { role: "ai", text: "Building your ER simulation now..." },
];

const buildSteps = [
  "6 nodes created",
  "5 connections made",
  "Sprites assigned",
];

const graphNodes = [
  { label: "Source 🧍", x: 50, y: 20, color: "var(--neon-cyan)" },
  { label: "Queue 🧍🧍", x: 50, y: 48, color: "var(--neon-yellow)" },
  { label: "🏥 Triage", x: 50, y: 76, color: "var(--neon-green)" },
  { label: "👨‍⚕️ Doctors", x: 50, y: 104, color: "var(--neon-orange)" },
  { label: "Sink ✓", x: 50, y: 132, color: "var(--neon-magenta)" },
];

const capabilities = [
  "Generate from scratch",
  "Modify existing models",
  "Explain bottlenecks",
  "Optimize parameters",
];

export default function AISection() {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [showSteps, setShowSteps] = React.useState<number>(0);
  const [graphVisible, setGraphVisible] = React.useState<number>(0);

  React.useEffect(() => {
    if (!inView) return;
    const t1 = setTimeout(() => {
      setShowSteps(1);
      const t2 = setTimeout(() => setShowSteps(2), 600);
      const t3 = setTimeout(() => setShowSteps(3), 1200);
      return () => { clearTimeout(t2); clearTimeout(t3); };
    }, 1500);
    const gInterval = setInterval(() => {
      setGraphVisible((v) => (v < graphNodes.length ? v + 1 : v));
    }, 500);
    const gTimeout = setTimeout(() => clearInterval(gInterval), 4000);
    return () => { clearTimeout(t1); clearTimeout(gTimeout); clearInterval(gInterval); };
  }, [inView]);

  return (
    <section
      id="ai"
      ref={ref}
      className="relative py-24 px-4"
      style={{ background: "rgba(0,0,0,0.3)" }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <span className="section-label" style={{ color: "var(--neon-magenta)" }}>
            AI ENGINE
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-4"
        >
          <h2
            className="font-display font-bold"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              letterSpacing: "0.08em",
              color: "#ffffff",
              textShadow: "0 0 20px rgba(255,0,255,0.3)",
            }}
          >
            DESCRIBE IT. WE SIMULATE IT.
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center max-w-2xl mx-auto mb-14 text-lg"
          style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
        >
          Don't know simulation theory? No problem. Just describe what you need in plain
          English and our Gemini-powered AI assistant builds the entire model for you.
        </motion.p>

        {/* Demo panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {/* Left: AI Chat */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="glass-panel-heavy p-5 space-y-4"
          >
            <div
              className="flex items-center gap-2 text-xs tracking-widest"
              style={{ fontFamily: "var(--font-mono)", color: "var(--neon-cyan)" }}
            >
              <span>🤖</span> AI ASSISTANT
              <span
                className="ml-auto w-2 h-2 rounded-full animate-pulse"
                style={{ background: "var(--neon-green)" }}
              />
            </div>

            <div className="space-y-3 min-h-[140px]">
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.6 + i * 0.4 }}
                  className={`px-3 py-2 rounded text-sm max-w-[90%] ${
                    msg.role === "user" ? "ml-auto" : "mr-auto"
                  }`}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    background:
                      msg.role === "user"
                        ? "rgba(0,242,255,0.1)"
                        : "rgba(112,0,255,0.15)",
                    border: `1px solid ${
                      msg.role === "user"
                        ? "rgba(0,242,255,0.2)"
                        : "rgba(112,0,255,0.3)"
                    }`,
                    color: msg.role === "user" ? "var(--neon-cyan)" : "#d8b4fe",
                  }}
                >
                  {msg.text}
                </motion.div>
              ))}
            </div>

            {/* Progress bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 1.4 }}
              className="space-y-2"
            >
              <div
                className="w-full h-1 rounded-full overflow-hidden"
                style={{ background: "rgba(0,242,255,0.1)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: "0%" }}
                  animate={inView ? { width: "78%" } : {}}
                  transition={{ delay: 1.5, duration: 1.5, ease: "easeOut" }}
                  style={{
                    background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-purple))",
                    boxShadow: "0 0 6px var(--neon-cyan)",
                  }}
                />
              </div>
              <div className="space-y-1.5">
                {buildSteps.slice(0, showSteps).map((step, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-xs"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--neon-green)" }}
                  >
                    <CheckCircle size={12} />
                    {step}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Input mock */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded text-xs"
              style={{
                background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(0,242,255,0.2)",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
              }}
            >
              <span>{">"}</span>
              <span>Type your simulation...</span>
              <span
                className="inline-block w-2 h-3 ml-1"
                style={{ background: "var(--neon-cyan)", animation: "blink-cursor 1s step-end infinite" }}
              />
            </div>
          </motion.div>

          {/* Right: Generated graph */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="glass-panel p-5"
          >
            <div
              className="text-xs tracking-widest mb-4"
              style={{ fontFamily: "var(--font-mono)", color: "var(--neon-cyan)" }}
            >
              GENERATED RESULT
            </div>
            <div className="relative" style={{ height: "200px" }}>
              {graphNodes.slice(0, graphVisible).map((node, i) => (
                <motion.div
                  key={node.label}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="absolute"
                  style={{ top: `${node.y}px`, left: "50%", transform: "translateX(-50%)" }}
                >
                  {i > 0 && (
                    <div
                      className="absolute"
                      style={{
                        top: "-20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "1px",
                        height: "18px",
                        background: `linear-gradient(180deg, transparent, ${node.color})`,
                      }}
                    />
                  )}
                  <div
                    className="px-4 py-1.5 rounded text-xs whitespace-nowrap"
                    style={{
                      fontFamily: "var(--font-mono)",
                      background: `${node.color}15`,
                      border: `1px solid ${node.color}50`,
                      color: node.color,
                      boxShadow: `0 0 8px ${node.color}30`,
                    }}
                  >
                    {node.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Capabilities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {capabilities.map((cap, i) => (
            <div
              key={cap}
              className="flex items-center gap-2 text-sm"
              style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
            >
              <span style={{ color: "var(--neon-cyan)" }}>✦</span>
              {cap}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
