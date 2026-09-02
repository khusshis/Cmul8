"use client";

import React from "react";
import { motion, useInView } from "framer-motion";
import { Layers, Play, Clock, Users, Database, GitBranch, Flag, Box, Crown, AlertTriangle, Hourglass, Code, Waypoints } from "lucide-react";

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

export default function FeaturesSection() {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" ref={ref} className="relative py-24 md:py-32 px-4 bg-white font-sans overflow-hidden">
      
      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 -left-[10%] w-[50vw] max-w-[800px] h-[50vw] max-h-[800px] rounded-full bg-indigo-50/70 blur-[100px]" />
        <div className="absolute top-[20%] -right-[10%] w-[50vw] max-w-[800px] h-[50vw] max-h-[800px] rounded-full bg-orange-50/70 blur-[100px]" />
        
        {/* Very subtle mesh overlay for texture */}
        <div className="absolute inset-0 opacity-[0.2] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col items-center text-center mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="px-4 py-1.5 rounded-full bg-indigo-50 mb-6 border border-indigo-100"
          >
            <span className="text-[11px] font-bold tracking-[0.15em] text-indigo-600 uppercase">
              SIMULATION TOOLKIT
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-[3rem] md:text-[4.5rem] font-space font-black leading-[1.05] text-[#111827] -tracking-[0.035em] mb-5"
          >
            Model Anything.<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#f97316]">
              Code Nothing.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl text-[1.1rem] md:text-[1.15rem] text-[#64748b] font-medium leading-relaxed"
          >
            The core of JustCmul8 is a 2D drag-and-drop workspace powered by React Flow, enabling anyone — the "Citizen Modeler" — to build a rigorous system model.
          </motion.p>
        </div>

        {/* --- CARDS LAYOUT --- */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* LEFT CARD: Core Primitives */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full lg:w-[40%] bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col"
          >
            {/* Card Header */}
            <div className="p-6 md:p-8 flex items-start gap-5 border-b border-gray-100">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner border border-indigo-100/50">
                <Layers size={28} strokeWidth={2} />
              </div>
              <div className="pt-1">
                <h3 className="font-space font-bold text-gray-900 text-xl tracking-tight">Core Primitives</h3>
                <p className="text-[#64748b] text-[13px] md:text-[14px] mt-1 font-medium">The building blocks of every simulation.</p>
              </div>
            </div>
            
            {/* Card Items */}
            <div className="flex-1 p-2 md:p-4">
              {coreNodes.map((node, i) => (
                <div key={node.name} className="flex items-start gap-4 p-4 hover:bg-gray-50/50 rounded-2xl transition-colors">
                  <div className="mt-1 w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <node.icon size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1e293b] text-[15px]">{node.name}</h4>
                    <p className="text-[#64748b] text-[13px] mt-0.5 leading-relaxed">{node.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT CARD: Advanced Logic Blocks */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full lg:w-[60%] bg-white rounded-[2rem] border border-orange-100/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col relative"
          >
            {/* Subtle glow effect behind right card */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-100/50 blur-[80px] rounded-full pointer-events-none" />

            {/* Card Header */}
            <div className="p-6 md:p-8 flex items-start gap-5 border-b border-gray-100 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 shadow-inner border border-orange-100/50">
                <Box size={28} strokeWidth={2} />
              </div>
              <div className="pt-1">
                <h3 className="font-space font-bold text-gray-900 text-xl tracking-tight">Advanced Logic Blocks</h3>
                <p className="text-[#64748b] text-[13px] md:text-[14px] mt-1 font-medium">Powerful components for complex scenarios.</p>
              </div>
            </div>
            
            {/* Card Items Grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 relative z-10">
              {advancedNodes.map((node, i) => {
                const isRightCol = i % 2 !== 0;
                const isBottomRow = i >= advancedNodes.length - 2;
                
                return (
                  <div 
                    key={node.name} 
                    className={`flex items-start gap-4 p-6 hover:bg-gray-50/30 transition-colors
                      ${!isRightCol ? 'sm:border-r border-gray-100' : ''} 
                      ${!isBottomRow ? 'border-b border-gray-100' : ''}
                      ${isBottomRow && !isRightCol ? 'border-b border-gray-100 sm:border-b-0' : ''}
                    `}
                  >
                    <div className="mt-1 w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                      <node.icon size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1e293b] text-[15px]">{node.name}</h4>
                      <p className="text-[#64748b] text-[13px] mt-1 leading-relaxed pr-2">{node.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
