"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Code2, BarChart3, AlertTriangle, Gauge, Pause, StepForward, Play, List, Cpu, Flag } from "lucide-react";
import { Backdrop, SectionHeader, Stagger, StaggerItem, TiltCard, spring, EASE_OUT } from "@/components/landing/motionKit";

// A value that slides in from below (never a hard cut).
function Swap({ value, className = "" }: { value: string | number; className?: string }) {
  return (
    <span className={`relative inline-flex overflow-hidden ${className}`}>
      {/* Enter-only: the keyed span remounts per value, so old values never linger */}
      <motion.span
        key={value}
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: "0%", opacity: 1 }}
        transition={spring(16, 0.9)}
        className="tabular-nums"
      >
        {value}
      </motion.span>
    </span>
  );
}

const CODE: React.ReactNode[] = [
  <span key="0" className="text-gray-400">engine.py</span>,
  <span key="1"><span className="text-purple-600">import</span> <span className="text-gray-800">simpy</span></span>,
  <span key="2"><span className="text-blue-500">env</span> <span className="text-gray-800">= simpy.Environment()</span></span>,
  <span key="3"><span className="text-blue-500">def</span> <span className="text-indigo-500">process</span><span className="text-gray-800">(env):</span></span>,
  <span key="4" className="pl-3"><span className="text-purple-600">yield</span> <span className="text-gray-800">env.timeout(5)</span></span>,
  <span key="5" className="text-gray-800">env.process(process(env))</span>,
  <span key="6" className="text-gray-800">env.run()</span>,
];

const Card1Code = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const visible = useInView(ref);
  const [events, setEvents] = useState(1248);
  const [time, setTime] = useState(12 * 60 + 45);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      setEvents((e) => e + Math.floor(Math.random() * 3) + 1);
      setTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [visible]);

  const h = Math.floor(time / 3600).toString().padStart(2, "0");
  const m = Math.floor((time % 3600) / 60).toString().padStart(2, "0");
  const s = (time % 60).toString().padStart(2, "0");

  return (
    <div ref={ref} className="bg-[#f8fafc] rounded-2xl p-4 border border-gray-100 flex gap-3 h-[180px]">
      <div className="flex-1 min-w-0 font-mono text-[10px] leading-[1.75] overflow-hidden">
        {CODE.map((line, i) => (
          <motion.div
            key={i}
            className={`whitespace-nowrap ${i === 0 ? "mb-1" : ""} ${i === 3 || i === 5 ? "mt-1" : ""}`}
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            animate={inView ? { clipPath: "inset(0 0% 0 0)" } : {}}
            transition={{ duration: 0.35, delay: 0.3 + i * 0.22, ease: "linear" }}
          >
            {line}
            {i === CODE.length - 1 && <span className="inline-block w-1.5 h-3 -mb-0.5 ml-1 bg-gray-400 animate-pulse" />}
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={spring(12, 0.8, 0.3 + CODE.length * 0.22)}
        className="w-[100px] shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col gap-3"
      >
        <div className="flex items-center gap-1.5">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-70" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-green-500" />
          </span>
          <span className="text-[9px] font-bold text-gray-700 leading-tight">Simulation<br />Running</span>
        </div>
        <div>
          <div className="text-[9px] text-gray-400">Time</div>
          <div className="text-[11px] font-bold text-gray-900 font-mono">{h}:{m}:<Swap value={s} /></div>
        </div>
        <div>
          <div className="text-[9px] text-gray-400">Events</div>
          <div className="text-[11px] font-bold text-gray-900 font-mono"><Swap value={events.toLocaleString()} /></div>
        </div>
      </motion.div>
    </div>
  );
};

const CHART = "M0,80 L10,60 L20,70 L30,40 L40,45 L50,20 L60,30 L70,35 L80,50 L90,20 L100,10 L110,60 L120,70 L130,40 L140,45 L150,20 L160,30 L170,35 L180,50 L190,20 L200,10";

const Card2Kpi = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [tp, setTp] = useState(34);
  const [util, setUtil] = useState(68);
  const [wait, setWait] = useState(2.35);

  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      setTp(30 + Math.floor(Math.random() * 8));
      setUtil(65 + Math.floor(Math.random() * 10));
      setWait(Number((2.1 + Math.random() * 0.4).toFixed(2)));
    }, 2000);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <div ref={ref} className="bg-[#f8fafc] rounded-2xl p-4 border border-gray-100 flex flex-col gap-3 h-[180px]">
      <div className="flex gap-2">
        {[
          { k: "Throughput", v: `${tp} / min` },
          { k: "Utilization", v: `${util}%` },
          { k: "Avg. Wait", v: `${wait} min` },
        ].map((c) => (
          <div key={c.k} className="flex-1 min-w-0 bg-white rounded-lg border border-gray-100 p-2">
            <div className="text-[8px] text-gray-400 mb-0.5 truncate">{c.k}</div>
            <Swap value={c.v} className="text-[11px] font-bold text-gray-900" />
          </div>
        ))}
      </div>
      <div className="flex-1 bg-white rounded-lg border border-gray-100 p-3 flex flex-col relative overflow-hidden">
        <div className="text-[9px] font-bold text-gray-700 mb-1 flex justify-between">
          Throughput Over Time
          <div className="flex gap-0.5 items-end h-3">
            {[0, 1, 2].map((i) => (
              <span key={i} className="lp-bar w-1 h-3 bg-green-500 rounded-sm" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[7px] text-gray-400 z-10 bg-white/90 pr-1">
            <span>60</span><span>40</span><span>20</span><span>0</span>
          </div>
          {/* The path is two identical periods; sliding one period left loops seamlessly */}
          <svg className="absolute inset-y-0 left-4 right-0 h-full w-[calc(100%-1rem)]" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="engineChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="lp-chart">
              <path d={`${CHART} L200,100 L0,100 Z`} fill="url(#engineChartGrad)" />
              <path d={CHART} fill="none" stroke="#22c55e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

const Card3Nodes = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [nodes, setNodes] = useState({
    src: { x: 0, y: 120, title: "Source", icon: Play, col: "text-indigo-500", border: "border-l-indigo-500", bg: "bg-white", l1: "" },
    queue: { x: 180, y: 120, title: "Queue", icon: List, col: "text-gray-500", border: "border-l-gray-400", bg: "bg-white", l1: "" },
    m1: { x: 360, y: 30, title: "Machine 1", l1: "Util: 65%", icon: Cpu, col: "text-green-600", border: "border-l-green-500", bg: "bg-white" },
    m2: { x: 360, y: 120, title: "Machine 2", l1: "Util: 98% (Slow)", icon: AlertTriangle, col: "text-red-600", border: "border-l-red-500", bg: "bg-red-50" },
    m3: { x: 360, y: 210, title: "Machine 3", l1: "Util: 62%", icon: Cpu, col: "text-green-600", border: "border-l-green-500", bg: "bg-white" },
    sink: { x: 540, y: 120, title: "Sink", icon: Flag, col: "text-gray-500", border: "border-l-gray-400", bg: "bg-white", l1: "" },
  });
  type K = keyof typeof nodes;
  const scale = 0.35;
  const [dragged, setDragged] = useState<K | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });

  const conns: { id: string; from: K; to: K; stroke: string; dur: string; slow?: boolean }[] = [
    { id: "l1", from: "src", to: "queue", stroke: "#cbd5e1", dur: "1s" },
    { id: "l2", from: "queue", to: "m1", stroke: "#cbd5e1", dur: "1.2s" },
    { id: "l3", from: "queue", to: "m2", stroke: "#fca5a5", dur: "3.5s", slow: true },
    { id: "l4", from: "queue", to: "m3", stroke: "#cbd5e1", dur: "1.1s" },
    { id: "l5", from: "m1", to: "sink", stroke: "#cbd5e1", dur: "1s" },
    { id: "l6", from: "m2", to: "sink", stroke: "#fca5a5", dur: "1s" },
    { id: "l7", from: "m3", to: "sink", stroke: "#cbd5e1", dur: "1s" },
  ];
  const bez = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = Math.abs(p2.x - p1.x);
    return `M ${p1.x} ${p1.y} C ${p1.x + dx * 0.4} ${p1.y}, ${p1.x + dx * 0.6} ${p2.y}, ${p2.x} ${p2.y}`;
  };

  return (
    <div
      ref={ref}
      className="bg-[#f8fafc] rounded-2xl border border-gray-100 h-[180px] relative overflow-hidden touch-none"
      onPointerMove={(e) => {
        if (!dragged) return;
        const dx = (e.clientX - lastPos.current.x) / scale;
        const dy = (e.clientY - lastPos.current.y) / scale;
        lastPos.current = { x: e.clientX, y: e.clientY };
        setNodes((p) => ({ ...p, [dragged]: { ...p[dragged], x: p[dragged].x + dx, y: p[dragged].y + dy } }));
      }}
      onPointerUp={() => setDragged(null)}
      onPointerLeave={() => setDragged(null)}
    >
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "8px 8px" }} />
      <div className="absolute left-1/2 top-1/2 w-[700px] h-[300px] origin-center" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="absolute inset-0 translate-x-[80px] translate-y-[30px]">
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            {conns.map((c, i) => {
              const d = bez(nodes[c.from], nodes[c.to]);
              return (
                <g key={c.id}>
                  <motion.path
                    d={d} stroke={c.stroke} strokeWidth="3" fill="none"
                    initial={{ pathLength: 0 }}
                    animate={inView ? { pathLength: 1 } : {}}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.08, ease: EASE_OUT }}
                    className={c.slow ? "animate-pulse" : undefined}
                  />
                  {inView && (
                    <circle r="6" fill={c.stroke === "#cbd5e1" ? "#94a3b8" : "#ef4444"}>
                      <animateMotion dur={c.dur} repeatCount="indefinite" path={d} />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
          {(Object.keys(nodes) as K[]).map((key, i) => {
            const node = nodes[key];
            const hot = key === "m2";
            return (
              <motion.div
                key={key}
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture(e.pointerId);
                  setDragged(key);
                  lastPos.current = { x: e.clientX, y: e.clientY };
                }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={inView ? { opacity: 1, scale: dragged === key ? 1.1 : 1 } : {}}
                transition={spring(14, 0.7, 0.1 + i * 0.07)}
                className={`absolute w-[140px] -ml-[70px] -mt-[36px] ${node.bg} rounded-3xl shadow-sm border border-gray-200 border-l-[6px] ${node.border} p-4 flex gap-4 items-center z-10 select-none ${dragged === key ? "cursor-grabbing" : "cursor-grab"}`}
                style={{ left: node.x, top: node.y, touchAction: "none" }}
              >
                {hot && inView && (
                  <span className="lp-pulse absolute -inset-1 rounded-[28px] border-4 border-red-400 pointer-events-none" />
                )}
                <div className={node.col}><node.icon size={24} /></div>
                <div className="pointer-events-none">
                  <h5 className="text-[14px] font-bold text-gray-900 leading-tight">{node.title}</h5>
                  {node.l1 && <p className="text-[11px] font-bold text-gray-500 mt-1">{node.l1}</p>}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SPEEDS = [
  { label: "1x", mult: 1 },
  { label: "10x", mult: 5 },
  { label: "Max", mult: 15 },
];

const Card4Speed = () => {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(45);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || !visible) return;
    const id = setInterval(() => setProgress((p) => (p >= 100 ? 0 : Math.min(100, p + speed))), 100);
    return () => clearInterval(id);
  }, [speed, paused, visible]);

  return (
    <div ref={ref} className="bg-[#f8fafc] rounded-2xl p-5 border border-gray-100 h-[180px] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-700">Speed</span>
        <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
          {SPEEDS.map((s) => (
            <button key={s.label} onClick={() => setSpeed(s.mult)} className={`relative px-3 py-1 rounded-md text-[10px] font-bold transition-colors ${speed === s.mult ? "text-[#4531E5]" : "text-gray-500 hover:text-gray-900"}`}>
              {speed === s.mult && <motion.span layoutId="engine-speed-pill" className="absolute inset-0 rounded-md bg-[#ede9fe]" transition={spring(20, 0.8)} />}
              <span className="relative">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[11px] font-bold text-gray-700">Progress</span>
          <span className="text-[10px] font-bold text-gray-500 tabular-nums">{Math.floor(progress)}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full w-full bg-gradient-to-r from-[#8b5cf6] to-[#5742FF] rounded-full origin-left"
            animate={{ scaleX: progress / 100 }}
            transition={progress === 0 ? { duration: 0 } : spring(20, 1)}
          />
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => setPaused(!paused)} className={`flex-1 border rounded-xl py-2 flex items-center justify-center gap-2 shadow-sm text-[11px] font-bold transition-colors ${paused ? "bg-red-50 text-red-600 border-red-100" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}>
          {paused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />} {paused ? "Resume" : "Pause"}
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => setProgress((p) => Math.min(p + 10, 100))} className="flex-1 bg-white border border-gray-200 rounded-xl py-2 flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 text-[11px] font-bold text-gray-700">
          Step <StepForward size={12} fill="currentColor" />
        </motion.button>
      </div>
    </div>
  );
};

const CARDS = [
  { icon: Code2, tone: "bg-blue-50 text-blue-600", title: "Pyodide & WebAssembly", desc: "Run full simulations in-browser using Pyodide + WebAssembly. Zero server costs, full Python/SimPy execution.", demo: <Card1Code /> },
  { icon: BarChart3, tone: "bg-green-50 text-green-600", title: "Real-time KPI Dashboards", desc: "Live metrics and charts update as your simulation runs. Track throughput, utilization, wait time and more.", demo: <Card2Kpi /> },
  { icon: AlertTriangle, tone: "bg-red-50 text-red-500", title: "Bottleneck Detection", desc: "Automatically detect the slowest resources and highlight bottlenecks as your simulation progresses.", demo: <Card3Nodes /> },
  { icon: Gauge, tone: "bg-violet-50 text-violet-600", title: "Smart Speed Control", desc: "Control simulation speed with 1x, 10x, or max. Step through events or run freely to completion.", demo: <Card4Speed /> },
];

export default function EngineSection() {
  return (
    <section id="engine" className="relative py-20 md:py-32 px-4 bg-white font-sans overflow-hidden">
      <Backdrop tone="a" />
      <div className="relative z-10 max-w-[1300px] mx-auto">
        <SectionHeader
          title="Speed & Precision"
          accent="in Your Browser"
          sub="We bridge the gap between visual design and technical rigor by automatically generating and running Python's SimPy logic."
        />
        <Stagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6" gap={0.1}>
          {CARDS.map((c) => (
            <StaggerItem key={c.title} className="h-full">
              <TiltCard className="h-full rounded-[2rem]" max={4}>
                <motion.div
                  whileHover="hover"
                  initial="rest"
                  className="h-full bg-white rounded-[2rem] border border-[#ecebf7] shadow-[0_20px_50px_-30px_rgba(16,24,40,0.12)] hover:shadow-[0_30px_60px_-30px_rgba(16,24,40,0.16)] transition-shadow p-6 md:p-7 flex flex-col"
                >
                  <motion.div
                    variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: -8, scale: 1.08 } }}
                    transition={spring(16, 0.6)}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${c.tone}`}
                  >
                    <c.icon size={24} strokeWidth={2} />
                  </motion.div>
                  <h3 className="text-xl font-space font-bold text-gray-900 mb-2.5 tracking-tight">{c.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6 flex-1">{c.desc}</p>
                  {c.demo}
                </motion.div>
              </TiltCard>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
