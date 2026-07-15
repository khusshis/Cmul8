"use client";

import React from "react";

const tickerItems = [
  "SYSTEM_STATUS: DISCRETE EVENT ENVIRONMENT ONLINE",
  "RUNNING SIMPY CORE v4.1",
  "PYODIDE WASM ACTIVE",
  "12,847 SIMULATIONS EXECUTED",
  "ENTITIES PROCESSED: 2.4M",
  "AVG THROUGHPUT: 847/hr",
  "UPTIME: 99.97%",
  "GEMINI AI ENGINE: READY",
  "REACT FLOW CANVAS: NOMINAL",
  "PIXI.JS VIEWPORT: RENDERING",
];

export default function TickerSection() {
  const items = [...tickerItems, ...tickerItems]; // duplicate for seamless loop

  return (
    <div
      className="relative overflow-hidden py-3"
      style={{
        background: "var(--bg-secondary)",
        borderTop: "1px solid rgba(0,242,255,0.1)",
        borderBottom: "1px solid rgba(0,242,255,0.1)",
      }}
      aria-hidden="true"
    >
      <div className="marquee-track">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 mr-3"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              color: "var(--neon-cyan)",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "var(--neon-cyan)", opacity: 0.6 }}>◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
