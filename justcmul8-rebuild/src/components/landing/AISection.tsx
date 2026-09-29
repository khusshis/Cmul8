"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { Sparkles, BarChart2, Play, Search, Minus, Plus, Maximize, Minimize, Building2, List, Monitor, Flag, Clock, Users, Timer, TrendingUp, PieChart, Wand2, Edit3, SlidersHorizontal, CheckCircle2, Send, Square, RotateCcw } from "lucide-react";
import { Backdrop, Reveal, SectionHeader, Stagger, StaggerItem, VIEW, spring, EASE_OUT } from "@/components/landing/motionKit";

const PROMPT = "Create a hospital ER with 2 nurses and 3 doctors. Patients arrive every 5 minutes.";

const capabilities = [
  { title: "Generate from scratch", desc: "Describe your system in plain English.", icon: Wand2 },
  { title: "Modify existing models", desc: "Ask AI to update, extend or refactor.", icon: Edit3 },
  { title: "Explain bottlenecks", desc: "Understand what's slowing your system.", icon: BarChart2 },
  { title: "Optimize parameters", desc: "Let AI suggest the best improvements.", icon: SlidersHorizontal },
];

const initialNodes = {
  arrival: { x: 100, y: 160, title: "Patient Arrival", l1: "rate: 5 min", l2: "dist: exponential", icon: Building2, col: "text-purple-500", border: "border-l-purple-500" },
  nurseQ: { x: 280, y: 160, title: "Nurse Queue", l1: "capacity: ∞", l2: "discipline: FIFO", icon: List, col: "text-gray-500", border: "border-l-gray-400" },
  nurse1: { x: 460, y: 100, title: "Nurse 1", l1: "capacity: 1", l2: "service: 3 min", icon: Users, col: "text-green-500", border: "border-l-green-500" },
  nurse2: { x: 460, y: 220, title: "Nurse 2", l1: "capacity: 1", l2: "service: 3 min", icon: Users, col: "text-green-500", border: "border-l-green-500" },
  docQ: { x: 640, y: 160, title: "ER Queue", l1: "capacity: ∞", l2: "priority: high", icon: List, col: "text-gray-500", border: "border-l-gray-400" },
  doc1: { x: 820, y: 60, title: "Doctor 1", l1: "capacity: 1", l2: "service: 15 min", icon: Monitor, col: "text-blue-500", border: "border-l-blue-500" },
  doc2: { x: 820, y: 160, title: "Doctor 2", l1: "capacity: 1", l2: "service: 15 min", icon: Monitor, col: "text-blue-500", border: "border-l-blue-500" },
  doc3: { x: 820, y: 260, title: "Doctor 3", l1: "capacity: 1", l2: "service: 15 min", icon: Monitor, col: "text-blue-500", border: "border-l-blue-500" },
  exit: { x: 1000, y: 160, title: "Discharge", l1: "KPIs: true", l2: "", icon: Flag, col: "text-indigo-500", border: "border-l-indigo-500" },
};
type NodeKey = keyof typeof initialNodes;
const ORDER = Object.keys(initialNodes) as NodeKey[];

const connections: { id: string; from: NodeKey; to: NodeKey; col: string; dur: string }[] = [
  { id: "c1", from: "arrival", to: "nurseQ", col: "#a855f7", dur: "1.2s" },
  { id: "c2", from: "nurseQ", to: "nurse1", col: "#22c55e", dur: "1.1s" },
  { id: "c3", from: "nurseQ", to: "nurse2", col: "#22c55e", dur: "1.3s" },
  { id: "c4", from: "nurse1", to: "docQ", col: "#22c55e", dur: "1.4s" },
  { id: "c5", from: "nurse2", to: "docQ", col: "#22c55e", dur: "1.2s" },
  { id: "c6", from: "docQ", to: "doc1", col: "#3b82f6", dur: "1.5s" },
  { id: "c7", from: "docQ", to: "doc2", col: "#3b82f6", dur: "1.3s" },
  { id: "c8", from: "docQ", to: "doc3", col: "#3b82f6", dur: "1.6s" },
  { id: "c9", from: "doc1", to: "exit", col: "#3b82f6", dur: "1.2s" },
  { id: "c10", from: "doc2", to: "exit", col: "#3b82f6", dur: "1.4s" },
  { id: "c11", from: "doc3", to: "exit", col: "#3b82f6", dur: "1.1s" },
];

const bez = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  const dx = Math.abs(p2.x - p1.x);
  return `M ${p1.x} ${p1.y} C ${p1.x + dx * 0.4} ${p1.y}, ${p1.x + dx * 0.6} ${p2.y}, ${p2.x} ${p2.y}`;
};

/**
 * The scripted "AI builds it" sequence: type the prompt → progress → nodes pop in one by one → run.
 * `phase`: 0 idle, 1 typing, 2 building, 3 built.
 */
function useBuildScript(start: boolean, on: { start: () => void; built: () => void }) {
  const [run, setRun] = useState(0); // bump to replay
  const [typed, setTyped] = useState(0);
  const [placed, setPlaced] = useState(0);
  const [phase, setPhase] = useState(0);
  const cb = useRef(on);
  useEffect(() => {
    cb.current = on;
  });

  useEffect(() => {
    if (!start) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    at(0, () => { setTyped(0); setPlaced(0); setPhase(1); cb.current.start(); });
    let t = 300;
    for (let i = 1; i <= PROMPT.length; i++) { t += 22; at(t, () => setTyped(i)); }
    t += 350;
    at(t, () => setPhase(2));
    for (let i = 1; i <= ORDER.length; i++) { t += 230; at(t, () => setPlaced(i)); }
    t += 450;
    // Built → start the sim on its own, like the cursor pressed Run.
    at(t, () => { setPhase(3); cb.current.built(); });
    return () => timers.forEach(clearTimeout);
  }, [start, run]);

  return { typed, placed, phase, replay: () => setRun((r) => r + 1) };
}

// Owns the 150ms tick so only these numbers re-render, not the whole canvas.
function StatsBar({ running, active }: { running: boolean; active: boolean }) {
  const [n, setN] = useState(0);
  const [rand, setRand] = useState({ wait: 0, throughput: 0, util: 0 });
  useEffect(() => {
    if (!running || !active) return;
    const id = setInterval(() => {
      setN((t) => t + 1);
      setRand({
        wait: Number((2.1 + Math.random() * 0.4).toFixed(2)),
        throughput: 30 + Math.floor(Math.random() * 8),
        util: 65 + Math.floor(Math.random() * 12),
      });
    }, 150);
    return () => clearInterval(id);
  }, [running, active]);

  const secs = n * 45;
  const pad = (v: number) => v.toString().padStart(2, "0");
  const on = running && n > 0;
  const cells = [
    { icon: Clock, k: "Simulation Time", v: on ? `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}` : "00:00:00" },
    { icon: Users, k: "Entities Processed", v: on ? Math.floor(n * 1.8).toLocaleString() : "0" },
    { icon: Timer, k: "Avg. Wait Time", v: `${on ? rand.wait : "0.00"} min` },
    { icon: TrendingUp, k: "Throughput", v: `${on ? rand.throughput : "0"} / min` },
    { icon: PieChart, k: "Utilization", v: `${on ? rand.util : "0"}%` },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-4 px-1 pt-3 border-t border-[#f1f0fa]">
      {cells.map((c) => (
        <div key={c.k} className="flex flex-col items-center gap-1.5 last:col-span-2 sm:last:col-span-1">
          <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-center">
            <c.icon size={12} className="shrink-0" /> {c.k}
          </div>
          <div className="text-[15px] font-black text-[#161622] tabular-nums">{c.v}</div>
        </div>
      ))}
    </div>
  );
}

export default function AISection() {
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { once: true, margin: "-25%" });
  const onScreen = useInView(stageRef);
  const [isRunning, setIsRunning] = useState(false);
  const [runId, setRunId] = useState(0); // remounts StatsBar so each run starts from zero
  const { typed, placed, phase, replay } = useBuildScript(inView, {
    start: () => setIsRunning(false),
    built: () => { setRunId((r) => r + 1); setIsRunning(true); },
  });
  const [scale, setScale] = useState(0.7);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodes, setNodes] = useState(initialNodes);
  const [draggedNode, setDraggedNode] = useState<NodeKey | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Fit the 1100px-wide model to whatever width the canvas has (phones included).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(0.85, Math.max(0.3, el.clientWidth / 1120)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen]);

  // Esc closes fullscreen.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const toggleRun = () => {
    if (isRunning) setIsRunning(false);
    else { setRunId((r) => r + 1); setIsRunning(true); }
  };

  const onNodeDown = (key: NodeKey) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraggedNode(key);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onBgDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsPanning(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => {
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    if (!draggedNode && !isPanning) return;
    lastPos.current = { x: e.clientX, y: e.clientY };
    if (draggedNode) {
      setNodes((prev) => ({ ...prev, [draggedNode]: { ...prev[draggedNode], x: prev[draggedNode].x + dx / scale, y: prev[draggedNode].y + dy / scale } }));
    } else {
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  };
  const onUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDraggedNode(null);
    setIsPanning(false);
  };

  const visible = new Set(ORDER.slice(0, placed));
  const progress = phase >= 3 ? 1 : placed / ORDER.length;

  return (
    <section id="ai" className="relative py-20 md:py-32 px-4 bg-[#fcfcff] font-sans overflow-hidden">
      <Backdrop tone="b" />
      <div className="relative z-10 max-w-[1300px] mx-auto">
        <SectionHeader
          title="Describe it."
          accent="We simulate it."
          sub="Don't know simulation theory? No problem. Just describe what you need in plain English and our Gemini-powered AI assistant builds the entire model for you."
        />

        <div ref={stageRef} className="flex flex-col lg:flex-row gap-6 mb-8 relative">
          <AnimatePresence>
            {isFullscreen && (
              <motion.div
                className="fixed inset-0 bg-[#161622]/40 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFullscreen(false)}
              />
            )}
          </AnimatePresence>

          {/* LEFT: the assistant conversation plays out */}
          <Reveal className="w-full lg:w-[32%] relative z-30" delay={0.05}>
            <div className="h-full bg-white rounded-[2rem] border border-[#ecebf7] shadow-[0_30px_60px_-30px_rgba(16,24,40,0.1)] p-5 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#5742FF] text-white flex items-center justify-center">
                    <Sparkles size={15} />
                  </div>
                  <span className="font-bold tracking-tight text-[#161622] text-[14px]">AI ASSISTANT</span>
                </div>
                <button
                  onClick={replay}
                  disabled={phase === 1 || phase === 2}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#5742FF] px-2.5 py-1.5 rounded-full hover:bg-[#f5f3ff] disabled:opacity-30 transition"
                  aria-label="Replay the AI build"
                >
                  <RotateCcw size={12} /> Replay
                </button>
              </div>

              <div className="flex flex-col gap-4 mb-6 flex-1 min-h-[260px]">
                <AnimatePresence>
                  {typed > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={spring(14, 0.8)}
                      className="bg-gradient-to-br from-[#6d5bff] to-[#5742FF] text-white p-4 rounded-2xl rounded-tr-sm text-[14px] leading-relaxed shadow-[0_12px_24px_-12px_rgba(16,24,40,0.16)] self-end max-w-[95%] origin-bottom-right"
                    >
                      {PROMPT.slice(0, typed)}
                      {typed < PROMPT.length && <span className="inline-block w-[2px] h-[1em] -mb-[2px] ml-0.5 bg-white/80 animate-pulse" />}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {phase >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={spring(14, 0.8)}
                      className="bg-[#f6f4ff] border border-[#e4defd] text-[#5742FF] p-4 rounded-2xl rounded-tl-sm text-[14px] leading-relaxed self-start w-full origin-top-left"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} />
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={phase >= 3 ? "done" : "building"}
                            className="font-medium"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {phase >= 3 ? "Your ER model is ready." : "Building your ER simulation…"}
                          </motion.span>
                        </AnimatePresence>
                        <span className="ml-auto text-[11px] font-bold tabular-nums">{Math.round(progress * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#e4defd] rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#5742FF] rounded-full origin-left" animate={{ scaleX: progress }} initial={{ scaleX: 0 }} transition={spring(10, 0.9)} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col gap-2.5 pl-1">
                  {[
                    { label: "9 blocks created", show: placed >= ORDER.length },
                    { label: "11 connections made", show: phase >= 3 },
                    { label: "Sprites assigned", show: phase >= 3 },
                  ].map((c, i) => (
                    <AnimatePresence key={c.label}>
                      {c.show && (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={spring(14, 0.8, i * 0.12)}
                          className="flex items-center gap-2 text-[13px] text-[#12a150] font-medium"
                        >
                          <CheckCircle2 size={16} /> {c.label}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ))}
                </div>
              </div>

              <div className="bg-[#fafaff] border border-[#ecebf7] rounded-2xl p-3 flex items-center gap-3">
                <input type="text" placeholder="Type your simulation..." className="bg-transparent outline-none text-sm text-gray-700 w-full placeholder:text-gray-400 pl-1" disabled />
                <motion.span
                  animate={phase === 1 ? { scale: [1, 0.85, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3, delay: (PROMPT.length * 22) / 1000 + 0.3 }}
                  className="w-8 h-8 rounded-xl bg-[#5742FF] text-white flex items-center justify-center shrink-0"
                >
                  <Send size={15} className="ml-0.5" />
                </motion.span>
              </div>
            </div>
          </Reveal>

          {/* RIGHT: the model assembles itself on the canvas */}
          {/* No filter/transform left on this wrapper, or the fullscreen `fixed` card would be trapped inside it */}
          <motion.div
            className={`w-full lg:w-[68%] ${isFullscreen ? "" : "relative z-30"}`}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEW}
            transition={spring(12, 0.9, 0.15)}
          >
            <motion.div
              layout
              transition={spring(14, 0.9)}
              className={
                isFullscreen
                  ? "fixed inset-3 md:inset-10 z-50 bg-white rounded-3xl shadow-2xl p-4 md:p-8 flex flex-col"
                  : "h-full bg-white rounded-[2rem] border border-[#ecebf7] shadow-[0_30px_60px_-30px_rgba(16,24,40,0.1)] p-4 sm:p-6 flex flex-col"
              }
            >
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#fafaff] border border-[#ecebf7] text-[#64748b] flex items-center justify-center shrink-0">
                    <BarChart2 size={16} />
                  </div>
                  <span className="font-bold tracking-tight text-[#161622] text-[14px] truncate">GENERATED RESULT</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <motion.button
                    onClick={toggleRun}
                    whileTap={{ scale: 0.95 }}
                    className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${isRunning ? "bg-red-50 text-red-600 border border-red-100" : "bg-[#f5f3ff] text-[#5742FF] border border-[#e4defd]"}`}
                  >
                    {isRunning ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                    {isRunning ? "Stop" : "Run"}
                    {phase === 3 && isRunning && (
                      <motion.span className="absolute inset-0 rounded-xl border-2 border-[#5742FF]" initial={{ opacity: 0.8, scale: 1 }} animate={{ opacity: 0, scale: 1.4 }} transition={{ duration: 0.8 }} />
                    )}
                  </motion.button>
                  <div className="flex items-center bg-white border border-[#ecebf7] rounded-xl overflow-hidden">
                    <button onClick={() => setPan({ x: 0, y: 0 })} className="hidden sm:block p-2 text-gray-500 hover:bg-gray-50 border-r border-[#ecebf7]" title="Recenter"><Search size={16} /></button>
                    <button onClick={() => setScale((s) => Math.max(s - 0.12, 0.3))} className="p-2 text-gray-500 hover:bg-gray-50 border-r border-[#ecebf7]" title="Zoom out"><Minus size={16} /></button>
                    <button onClick={() => setScale((s) => Math.min(s + 0.12, 1.5))} className="p-2 text-gray-500 hover:bg-gray-50 sm:border-r border-[#ecebf7]" title="Zoom in"><Plus size={16} /></button>
                    <button onClick={() => setIsFullscreen((f) => !f)} className="hidden sm:block p-2 text-gray-500 hover:bg-gray-50" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
                      {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div
                ref={canvasRef}
                className={`flex-1 w-full relative min-h-[260px] sm:min-h-[320px] mb-5 bg-[#fafafe] rounded-[1.5rem] border border-[#f1f0fa] overflow-hidden touch-none select-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
                onPointerDown={onBgDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
              >
                <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: `${24 * scale}px ${24 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />
                <div className="absolute inset-0 origin-center" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                  <div className="absolute w-[1100px] h-[320px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                      {connections.map((c) => {
                        if (!visible.has(c.from) || !visible.has(c.to)) return null;
                        const d = bez(nodes[c.from], nodes[c.to]);
                        return (
                          <g key={c.id}>
                            <motion.path d={d} stroke={c.col} strokeWidth="2" fill="none" opacity={0.6} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: EASE_OUT }} />
                            {isRunning && onScreen && (
                              <circle r="4" fill={c.col}>
                                <animateMotion dur={c.dur} repeatCount="indefinite" path={d} />
                              </circle>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                    <AnimatePresence>
                      {ORDER.filter((k) => visible.has(k)).map((key) => {
                        const node = nodes[key];
                        return (
                          <motion.div
                            key={key}
                            onPointerDown={onNodeDown(key)}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: draggedNode === key ? 1.06 : 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ ...spring(15, 0.7) }}
                            className={`absolute w-[150px] -ml-[75px] -mt-[30px] bg-white rounded-2xl border border-gray-200 border-l-4 ${node.border} p-3 flex gap-3 items-center z-10 select-none ${draggedNode === key ? "cursor-grabbing shadow-lg" : "cursor-grab shadow-sm hover:shadow-md"}`}
                            style={{ left: node.x, top: node.y, touchAction: "none" }}
                          >
                            <div className={node.col}><node.icon size={18} /></div>
                            <div className="pointer-events-none">
                              <h5 className="text-[11px] font-bold text-gray-900 leading-tight">{node.title}</h5>
                              {node.l1 && <p className="text-[9px] text-gray-500 mt-0.5">{node.l1}<br />{node.l2}</p>}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
                <AnimatePresence>
                  {phase < 2 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-[#94a3b8] pointer-events-none"
                    >
                      Waiting for a prompt…
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <StatsBar key={runId} running={isRunning} active={onScreen} />
            </motion.div>
          </motion.div>
        </div>

        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" gap={0.08}>
          {capabilities.map((cap) => (
            <StaggerItem key={cap.title}>
              <motion.div
                whileHover="hover"
                initial="rest"
                className="h-full bg-white rounded-2xl p-5 border border-[#ecebf7] flex items-start gap-4 hover:border-[#d9d0fd] hover:shadow-[0_18px_36px_-18px_rgba(16,24,40,0.16)] transition-[border-color,box-shadow]"
              >
                <motion.div
                  variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: -10, scale: 1.1 } }}
                  transition={spring(16, 0.6)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#f5f3ff] text-[#5742FF]"
                >
                  <cap.icon size={20} strokeWidth={2} />
                </motion.div>
                <div>
                  <h4 className="font-space font-bold text-[14px] text-gray-900 mb-0.5">{cap.title}</h4>
                  <p className="text-[12px] text-gray-500 leading-snug">{cap.desc}</p>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
