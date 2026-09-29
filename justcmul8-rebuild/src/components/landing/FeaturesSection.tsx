"use client";

import React, { useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Layers, Play, Clock, Users, Database, GitBranch, Flag, Box, Crown, AlertTriangle, Hourglass, Code, Waypoints } from "lucide-react";
import { Backdrop, Reveal, SectionHeader, Stagger, StaggerItem, TiltCard, spring } from "@/components/landing/motionKit";

const coreNodes = [
  { icon: Play, name: "Source (Generator)", desc: "Generate entities at defined intervals." },
  { icon: Clock, name: "Service / Delay", desc: "Time-consuming activities with variable durations." },
  { icon: Users, name: "Resource (Capacity)", desc: "Limited staff or machines with configurable capacity." },
  { icon: Database, name: "Queue (Buffer)", desc: "Waiting areas with FIFO, LIFO, or priority disciplines." },
  { icon: GitBranch, name: "Decision (Router)", desc: "Route entities by probability or conditions." },
  { icon: Flag, name: "Sink (Termination)", desc: "Collect entities and calculate final KPIs." },
];

const advancedNodes = [
  { icon: Crown, name: "Priority Resource", desc: "High-priority entities bypass standard waiting lines." },
  { icon: AlertTriangle, name: "Preemptive Resource", desc: "Interrupt lower-priority tasks mid-service." },
  { icon: Hourglass, name: "Wait with Timeout (Renege)", desc: "Entities exit if maximum wait time is exceeded." },
  { icon: Box, name: "Container / Level", desc: "Manage flowable substances like fuel or raw material." },
  { icon: Code, name: "Event Trigger / Condition", desc: "React to state changes or schedule events dynamically." },
  { icon: Waypoints, name: "Store / Pipe", desc: "Async process communication for parallel flows." },
];

// One highlight glides down the primitives on its own; hovering takes over.
function CorePrimitives() {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (!inView || hovering) return;
    const id = setInterval(() => setActive((a) => (a + 1) % coreNodes.length), 2200);
    return () => clearInterval(id);
  }, [inView, hovering]);

  const ActiveIcon = coreNodes[active].icon;

  return (
    <div ref={ref} className="h-full bg-white rounded-[2rem] border border-[#ecebf7] shadow-[0_30px_60px_-30px_rgba(16,24,40,0.1)] overflow-hidden flex flex-col">
      <div className="p-6 md:p-8 flex items-start gap-5 border-b border-[#f1f0fa]">
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#5742FF] text-white flex items-center justify-center shrink-0 shadow-[0_12px_24px_-10px_rgba(16,24,40,0.16)] overflow-hidden">
          <motion.span key={active} initial={{ y: 22, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring(16, 0.85)}>
            <ActiveIcon size={26} strokeWidth={2} />
          </motion.span>
        </div>
        <div className="pt-1">
          <h3 className="font-space font-bold text-[#161622] text-xl tracking-tight flex items-center gap-2">
            <Layers size={16} className="text-[#8b5cf6]" /> Core Primitives
          </h3>
          <p className="text-[#64748b] text-[13px] md:text-[14px] mt-1 font-medium">The building blocks of every simulation.</p>
        </div>
      </div>

      <div className="relative isolate flex-1 p-2 md:p-3" onMouseLeave={() => setHovering(false)}>
        {coreNodes.map((node, i) => {
          const on = i === active;
          return (
            <div
                key={node.name}
                onMouseEnter={() => { setHovering(true); setActive(i); }}
                className="relative flex items-start gap-4 p-4 rounded-2xl cursor-default"
              >
                {on && (
                  <motion.div
                    layoutId="core-highlight"
                    className="absolute inset-0 rounded-2xl bg-[#f6f4ff] border border-[#e4defd]"
                    transition={spring(18, 0.85)}
                  />
                )}
                <motion.div
                  animate={{ scale: on ? 1.08 : 1, backgroundColor: on ? "#5742FF" : "#eef2ff", color: on ? "#ffffff" : "#5742FF" }}
                  transition={spring(16, 0.8)}
                  className="relative z-10 mt-0.5 w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                >
                  <node.icon size={18} strokeWidth={2.5} />
                </motion.div>
                <div className="relative z-10">
                  <h4 className="font-bold text-[#1e293b] text-[15px]">{node.name}</h4>
                  <p className="text-[#64748b] text-[13px] mt-0.5 leading-relaxed">{node.desc}</p>
                </div>
                {on && !hovering && (
                  <motion.span
                    key={`bar-${active}`}
                    className="absolute left-4 right-4 bottom-1.5 h-[2px] rounded-full bg-[#8b5cf6]/50 origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 2.2, ease: "linear" }}
                  />
                )}
              </div>
          );
        })}
      </div>
    </div>
  );
}

function AdvancedBlocks() {
  return (
    <div className="h-full bg-white rounded-[2rem] border border-[#ecebf7] shadow-[0_30px_60px_-30px_rgba(16,24,40,0.1)] overflow-hidden flex flex-col relative">
      <div className="p-6 md:p-8 flex items-start gap-5 border-b border-[#f1f0fa] relative z-10">
        <motion.div
          whileHover={{ rotate: 90 }}
          transition={spring(12, 0.7)}
          className="w-14 h-14 rounded-2xl bg-[#f5f3ff] text-[#8b5cf6] flex items-center justify-center shrink-0 border border-[#e4defd]"
        >
          <Box size={28} strokeWidth={2} />
        </motion.div>
        <div className="pt-1">
          <h3 className="font-space font-bold text-[#161622] text-xl tracking-tight">Advanced Logic Blocks</h3>
          <p className="text-[#64748b] text-[13px] md:text-[14px] mt-1 font-medium">Powerful components for complex scenarios.</p>
        </div>
      </div>

      <Stagger className="flex-1 grid grid-cols-1 sm:grid-cols-2 relative z-10" gap={0.08} delay={0.15}>
        {advancedNodes.map((node, i) => (
          <StaggerItem
            key={node.name}
            className={`border-[#f1f0fa] ${i % 2 === 0 ? "sm:border-r" : ""} ${i < advancedNodes.length - 1 ? "border-b" : ""} ${i === advancedNodes.length - 2 ? "sm:border-b-0" : ""}`}
          >
            <motion.div whileHover="hover" initial="rest" className="group h-full flex items-start gap-4 p-6 hover:bg-[#faf9ff] transition-colors">
              <motion.div
                variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: -8, scale: 1.1 } }}
                transition={spring(16, 0.6)}
                className="mt-0.5 w-10 h-10 rounded-full bg-[#f5f3ff] text-[#8b5cf6] group-hover:bg-[#8b5cf6] group-hover:text-white transition-colors flex items-center justify-center shrink-0"
              >
                <node.icon size={18} strokeWidth={2.5} />
              </motion.div>
              <div>
                <motion.h4 variants={{ rest: { x: 0 }, hover: { x: 3 } }} transition={spring(18, 0.8)} className="font-bold text-[#1e293b] text-[15px]">
                  {node.name}
                </motion.h4>
                <p className="text-[#64748b] text-[13px] mt-1 leading-relaxed pr-2">{node.desc}</p>
              </div>
            </motion.div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 md:py-32 px-4 bg-white font-sans overflow-hidden">
      <Backdrop tone="a" />
      <div className="relative z-10 max-w-[1280px] mx-auto">
        <SectionHeader
          title="Model Anything."
          accent="Code Nothing."
          sub={`The core of JustCmul8 is a 2D drag-and-drop workspace powered by React Flow, enabling anyone — the "Citizen Modeler" — to build a rigorous system model.`}
        />

        <div className="flex flex-col lg:flex-row gap-6">
          <Reveal className="w-full lg:w-[40%]" delay={0.1}>
            <TiltCard className="h-full rounded-[2rem]" max={3}>
              <CorePrimitives />
            </TiltCard>
          </Reveal>
          <Reveal className="w-full lg:w-[60%]" delay={0.2}>
            <TiltCard className="h-full rounded-[2rem]" max={3}>
              <AdvancedBlocks />
            </TiltCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
