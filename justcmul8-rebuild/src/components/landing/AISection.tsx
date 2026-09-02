"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BarChart2, Play, Search, Minus, Plus, Maximize, Building2, List, Monitor, Flag, Clock, Users, Timer, TrendingUp, PieChart, Wand2, Edit3, SlidersHorizontal, CheckCircle2, Send, Square } from "lucide-react";

const capabilities = [
  { title: "Generate from scratch", desc: "Describe your system in plain English.", icon: Wand2, color: "text-indigo-600", bg: "bg-indigo-50" },
  { title: "Modify existing models", desc: "Ask AI to update, extend or refactor.", icon: Edit3, color: "text-blue-500", bg: "bg-blue-50" },
  { title: "Explain bottlenecks", desc: "Understand what's slowing your system.", icon: BarChart2, color: "text-pink-500", bg: "bg-pink-50" },
  { title: "Optimize parameters", desc: "Let AI suggest the best improvements.", icon: SlidersHorizontal, color: "text-purple-600", bg: "bg-purple-50" },
];

const initialNodes = {
  arrival: { x: 100,  y: 160, title: "Patient Arrival", l1: "rate: 5 min", l2: "dist: exponential", icon: Building2, col: "text-purple-500", border: "border-l-purple-500" },
  nurseQ:  { x: 280, y: 160, title: "Nurse Queue", l1: "capacity: ∞", l2: "discipline: FIFO", icon: List, col: "text-gray-500", border: "border-l-gray-400" },
  nurse1:  { x: 460, y: 100, title: "Nurse 1", l1: "capacity: 1", l2: "service: 3 min", icon: Users, col: "text-green-500", border: "border-l-green-500" },
  nurse2:  { x: 460, y: 220, title: "Nurse 2", l1: "capacity: 1", l2: "service: 3 min", icon: Users, col: "text-green-500", border: "border-l-green-500" },
  docQ:    { x: 640, y: 160, title: "ER Queue", l1: "capacity: ∞", l2: "priority: high", icon: List, col: "text-gray-500", border: "border-l-gray-400" },
  doc1:    { x: 820, y: 60,  title: "Doctor 1", l1: "capacity: 1", l2: "service: 15 min", icon: Monitor, col: "text-blue-500", border: "border-l-blue-500" },
  doc2:    { x: 820, y: 160, title: "Doctor 2", l1: "capacity: 1", l2: "service: 15 min", icon: Monitor, col: "text-blue-500", border: "border-l-blue-500" },
  doc3:    { x: 820, y: 260, title: "Doctor 3", l1: "capacity: 1", l2: "service: 15 min", icon: Monitor, col: "text-blue-500", border: "border-l-blue-500" },
  exit:    { x: 1000, y: 160, title: "Discharge", l1: "KPIs: true", l2: "", icon: Flag, col: "text-indigo-500", border: "border-l-indigo-500" }
};

const connections = [
  { id: 'c1', from: 'arrival', to: 'nurseQ', col: '#a855f7', dur: '1.2s' },
  { id: 'c2', from: 'nurseQ', to: 'nurse1', col: '#22c55e', dur: '1.1s' },
  { id: 'c3', from: 'nurseQ', to: 'nurse2', col: '#22c55e', dur: '1.3s' },
  { id: 'c4', from: 'nurse1', to: 'docQ',    col: '#22c55e', dur: '1.4s' },
  { id: 'c5', from: 'nurse2', to: 'docQ',    col: '#22c55e', dur: '1.2s' },
  { id: 'c6', from: 'docQ',    to: 'doc1',    col: '#3b82f6', dur: '1.5s' },
  { id: 'c7', from: 'docQ',    to: 'doc2',    col: '#3b82f6', dur: '1.3s' },
  { id: 'c8', from: 'docQ',    to: 'doc3',    col: '#3b82f6', dur: '1.6s' },
  { id: 'c9', from: 'doc1',    to: 'exit',    col: '#3b82f6', dur: '1.2s' },
  { id: 'c10', from: 'doc2',   to: 'exit',    col: '#3b82f6', dur: '1.4s' },
  { id: 'c11', from: 'doc3',   to: 'exit',    col: '#3b82f6', dur: '1.1s' },
];

export default function AISection() {
  const [isRunning, setIsRunning] = useState(false);
  const [ticks, setTicks] = useState(0);
  const [scale, setScale] = useState(0.7);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [nodes, setNodes] = useState(initialNodes);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState({ 
    time: "00:00:00", 
    entities: 0, 
    wait: 0, 
    throughput: 0, 
    util: 0 
  });

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setTicks(t => t + 1), 150);
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (ticks === 0) return;
    const simSeconds = ticks * 45; 
    const h = Math.floor(simSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((simSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (simSeconds % 60).toString().padStart(2, '0');
    
    setStats({
      time: `${h}:${m}:${s}`,
      entities: Math.floor(ticks * 1.8),
      wait: Number((2.1 + Math.random() * 0.4).toFixed(2)),
      throughput: 30 + Math.floor(Math.random() * 8),
      util: 65 + Math.floor(Math.random() * 12),
    });
  }, [ticks]);

  const toggleRun = () => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      setTicks(0); 
      setIsRunning(true);
    }
  };

  const handlePointerDownNode = (key: string) => (e: React.PointerEvent) => {
    e.stopPropagation(); // Prevent panning when clicking a node
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraggedNode(key);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerDownBg = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsPanning(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggedNode) {
      const dx = (e.clientX - lastPos.current.x) / scale;
      const dy = (e.clientY - lastPos.current.y) / scale;
      lastPos.current = { x: e.clientX, y: e.clientY };
      
      setNodes(prev => ({
        ...prev,
        [draggedNode]: {
           ...prev[draggedNode as keyof typeof prev],
           x: prev[draggedNode as keyof typeof prev].x + dx,
           y: prev[draggedNode as keyof typeof prev].y + dy
        }
      }));
    } else if (isPanning) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture(e.pointerId);
    setDraggedNode(null);
    setIsPanning(false);
  };

  const bez = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    const dx = Math.abs(p2.x - p1.x);
    const midX1 = p1.x + dx * 0.4;
    const midX2 = p1.x + dx * 0.6;
    return `M ${p1.x} ${p1.y} C ${midX1} ${p1.y}, ${midX2} ${p2.y}, ${p2.x} ${p2.y}`;
  };

  return (
    <section id="ai" className="relative py-24 md:py-32 px-4 bg-white font-sans overflow-hidden">
      
      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 -left-[10%] w-[60vw] max-w-[900px] h-[60vw] max-h-[900px] rounded-full bg-indigo-50/80 blur-[120px]" />
        <div className="absolute top-10 -right-[10%] w-[60vw] max-w-[900px] h-[60vw] max-h-[900px] rounded-full bg-orange-50/60 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1300px] mx-auto">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col items-center text-center mb-12 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5f3ff] mb-6"
          >
            <Sparkles size={12} className="text-[#8b5cf6]" />
            <span className="text-[11px] font-bold tracking-[0.15em] text-[#8b5cf6] uppercase">
              AI ENGINE
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[3rem] md:text-[4.5rem] font-space font-black leading-[1.05] text-[#111827] -tracking-[0.035em] mb-5"
          >
            Describe it. <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#f97316]">We simulate it.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="max-w-2xl text-[1.1rem] text-[#64748b] font-medium leading-relaxed"
          >
            Don't know simulation theory? No problem. Just describe what you need in plain English and our Gemini-powered AI assistant builds the entire model for you.
          </motion.p>
        </div>

        {/* --- INTERACTIVE CARDS --- */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8 relative">
          
          {/* Fullscreen backdrop */}
          {isFullscreen && (
            <div 
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" 
              onClick={() => setIsFullscreen(false)} 
            />
          )}

          {/* LEFT CARD: AI ASSISTANT */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-full lg:w-[32%] bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col relative z-30"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <span className="font-bold tracking-tight text-gray-900">AI ASSISTANT</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>

            {/* Chat Log */}
            <div className="flex flex-col gap-4 mb-8 flex-1">
              {/* User Message */}
              <div className="bg-[#5742FF] text-white p-4 rounded-2xl rounded-tr-sm text-[14px] leading-relaxed shadow-sm self-end max-w-[95%]">
                Create a hospital ER with 2 nurses and 3 doctors. Patients arrive every 5 minutes.
              </div>
              
              {/* AI Message */}
              <div className="bg-indigo-50/50 border border-indigo-100 text-[#5742FF] p-4 rounded-2xl rounded-tl-sm text-[14px] leading-relaxed shadow-sm self-start w-full relative overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} />
                  <span className="font-medium">Building your ER simulation now...</span>
                  <div className="ml-auto flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
                <div className="w-full h-1 bg-indigo-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#5742FF] rounded-full w-[70%]" />
                </div>
              </div>

              {/* Checkmarks */}
              <div className="flex flex-col gap-2.5 mt-2 pl-2">
                <div className="flex items-center gap-2 text-[13px] text-green-600 font-medium">
                  <CheckCircle2 size={16} /> 9 blocks created
                </div>
                <div className="flex items-center gap-2 text-[13px] text-green-600 font-medium">
                  <CheckCircle2 size={16} /> 11 connections made
                </div>
                <div className="flex items-center gap-2 text-[13px] text-green-600 font-medium">
                  <CheckCircle2 size={16} /> Sprites assigned
                </div>
              </div>
            </div>

            {/* Input Bar */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex items-center gap-3">
              <input type="text" placeholder="Type your simulation..." className="bg-transparent border-none outline-none text-sm text-gray-700 w-full placeholder:text-gray-400 pl-1" disabled />
              <button className="w-8 h-8 rounded-xl bg-[#5742FF]/10 text-[#5742FF] flex items-center justify-center shrink-0">
                <Send size={16} className="ml-0.5" />
              </button>
            </div>
          </motion.div>

          {/* RIGHT CARD: GENERATED RESULT */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`transition-all duration-300 ${isFullscreen ? "fixed inset-4 md:inset-10 z-50 bg-white rounded-3xl shadow-2xl p-4 md:p-8 flex flex-col" : "w-full lg:w-[68%] bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col relative z-30"}`}
          >
            {/* Header & Controls */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 flex items-center justify-center">
                  <BarChart2 size={16} />
                </div>
                <span className="font-bold tracking-tight text-gray-900">GENERATED RESULT</span>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={toggleRun}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${isRunning ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 'bg-[#f5f3ff] text-[#5742FF] border border-indigo-100 hover:bg-indigo-50'}`}
                >
                  {isRunning ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                  {isRunning ? 'Stop' : 'Run'}
                </button>
                
                <div className="hidden sm:flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <button onClick={() => setScale(1)} className="p-2 text-gray-500 hover:bg-gray-50 border-r border-gray-200" title="Reset Zoom"><Search size={16} /></button>
                  <button onClick={() => setScale(s => Math.max(s - 0.15, 0.5))} className="p-2 text-gray-500 hover:bg-gray-50 border-r border-gray-200" title="Zoom Out"><Minus size={16} /></button>
                  <button onClick={() => setScale(s => Math.min(s + 0.15, 1.5))} className="p-2 text-gray-500 hover:bg-gray-50 border-r border-gray-200" title="Zoom In"><Plus size={16} /></button>
                  <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-gray-500 hover:bg-gray-50" title="Toggle Fullscreen"><Maximize size={16} /></button>
                </div>
              </div>
            </div>

            {/* Canvas Area */}
            <div 
              ref={canvasRef}
              className={`flex-1 w-full relative min-h-[300px] mb-8 bg-[#fafafa] rounded-[1.5rem] border border-gray-100 overflow-hidden touch-none select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={handlePointerDownBg}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              
              {/* Dotted Grid Background (scales with content) */}
              <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: `${24 * scale}px ${24 * scale}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />

              {/* Pan/Zoom Container */}
              <div 
                className="absolute inset-0 origin-center transition-transform duration-75"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
              >
                <div className="relative w-full h-full min-w-[950px] min-h-[320px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  
                  {/* Dynamic SVG Connections */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                    {connections.map(conn => (
                      <g key={conn.id}>
                        <path 
                          d={bez(nodes[conn.from as keyof typeof nodes], nodes[conn.to as keyof typeof nodes])} 
                          stroke={conn.col} 
                          strokeWidth="2" 
                          fill="none" 
                          opacity={0.6}
                          strokeDasharray={isRunning ? "4 4" : "none"} 
                          className={isRunning ? "animate-[dash_1s_linear_infinite]" : ""}
                        />
                        {isRunning && (
                          <circle r="4" fill={conn.col}>
                            <animateMotion dur={conn.dur} repeatCount="indefinite" path={bez(nodes[conn.from as keyof typeof nodes], nodes[conn.to as keyof typeof nodes])} />
                          </circle>
                        )}
                      </g>
                    ))}
                  </svg>

                  {/* HTML Draggable Nodes */}
                  {Object.entries(nodes).map(([key, node]) => (
                    <div 
                      key={key}
                      onPointerDown={handlePointerDownNode(key)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 w-[150px] bg-white rounded-2xl shadow-sm border border-gray-200 border-l-4 ${node.border} p-3 flex gap-3 items-center z-10 hover:shadow-md transition-shadow select-none ${draggedNode === key ? 'cursor-grabbing scale-105 shadow-lg' : 'cursor-grab'}`} 
                      style={{ left: `${node.x}px`, top: `${node.y}px`, touchAction: 'none' }}
                    >
                      <div className={node.col}><node.icon size={18} /></div>
                      <div className="pointer-events-none">
                        <h5 className="text-[11px] font-bold text-gray-900 leading-tight">{node.title}</h5>
                        {node.l1 && <p className="text-[9px] text-gray-500 mt-0.5">{node.l1}<br/>{node.l2}</p>}
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="flex justify-between px-2 pt-2 border-t border-gray-100 overflow-x-auto no-scrollbar gap-4">
              <div className="flex flex-col items-center gap-1.5 min-w-max">
                <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                  <Clock size={12} /> Simulation Time
                </div>
                <div className="text-[15px] font-black text-gray-900">{isRunning ? stats.time : "00:00:00"}</div>
              </div>
              <div className="flex flex-col items-center gap-1.5 min-w-max">
                <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                  <Users size={12} /> Entities Processed
                </div>
                <div className="text-[15px] font-black text-gray-900">{isRunning ? stats.entities.toLocaleString() : "0"}</div>
              </div>
              <div className="flex flex-col items-center gap-1.5 min-w-max">
                <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                  <Timer size={12} /> Avg. Wait Time
                </div>
                <div className="text-[15px] font-black text-gray-900">{isRunning ? stats.wait : "0.00"} min</div>
              </div>
              <div className="flex flex-col items-center gap-1.5 min-w-max">
                <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                  <TrendingUp size={12} /> Throughput
                </div>
                <div className="text-[15px] font-black text-gray-900">{isRunning ? stats.throughput : "0"} / min</div>
              </div>
              <div className="flex flex-col items-center gap-1.5 min-w-max">
                <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                  <PieChart size={12} /> Utilization
                </div>
                <div className="text-[15px] font-black text-gray-900">{isRunning ? stats.util : "0"}%</div>
              </div>
            </div>

          </motion.div>
        </div>

        {/* --- BOTTOM CAPABILITIES ROW --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cap.bg} ${cap.color}`}>
                <cap.icon size={20} strokeWidth={2} />
              </div>
              <div>
                <h4 className="font-space font-bold text-[14px] text-gray-900 mb-0.5">{cap.title}</h4>
                <p className="text-[12px] text-gray-500 leading-tight">{cap.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
