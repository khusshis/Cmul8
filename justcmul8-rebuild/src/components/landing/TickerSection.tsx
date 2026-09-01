"use client";

import React from "react";
import { motion } from "framer-motion";

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
  // We duplicate the items to create a perfectly seamless loop 
  // when translating the container by exactly -50%
  const items = [...tickerItems, ...tickerItems];

  return (
    <div
      className="relative overflow-hidden py-3.5 bg-transparent flex"
      style={{
        WebkitMaskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
        maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)"
      }}
      aria-hidden="true"
    >
      <motion.div
        className="flex whitespace-nowrap min-w-max"
        animate={{ x: [0, "-50%"] }}
        transition={{ 
          repeat: Infinity, 
          ease: "linear", 
          duration: 35 
        }}
      >
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3.5 mx-6 text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#64748b] uppercase"
          >
            <span className="text-[#8b5cf6] opacity-70 text-[8px]">◆</span>
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
