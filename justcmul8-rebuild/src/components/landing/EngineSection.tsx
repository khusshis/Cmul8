"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Code2, BarChart3, AlertTriangle, Gauge, ArrowUpRight, Pause, StepForward, Play, List, Cpu, Flag } from "lucide-react";

/* --- Subcomponents for Interactive Cards --- */

const Card1Code = () => {
  const [events, setEvents] = useState(1248);
  const [time, setTime] = useState(12 * 60 + 45);

  useEffect(() => {
    const int = setInterval(() => {
      setEvents(e => e + Math.floor(Math.random() * 3) + 1);
      setTime(t => t + 1);
    }, 1000);
    return () => clearInterval(int);
  }, []);

  const h = Math.floor(time / 3600).toString().padStart(2, '0');
  const m = Math.floor((time % 3600) / 60).toString().padStart(2, '0');
  const s = (time % 60).toString().padStart(2, '0');

  return (
    <div className="bg-[#f8fafc] rounded-2xl p-4 border border-gray-100 flex gap-3 h-[180px]">
      <div className="flex-1 font-mono text-[10px] leading-relaxed relative overflow-hidden">
        <div className="text-gray-400 mb-2">engine.py</div>
        <div className="text-purple-600">import <span className="text-gray-800">simpy</span></div>
        <div className="text-blue-500 mt-1">env <span className="text-gray-800">= simpy.Environment()</span></div>
        <div className="text-blue-500 mt-2">def <span className="text-indigo-500">process</span><span className="text-gray-800">(env):</span></div>
        <div className="text-purple-600 ml-3">yield <span className="text-gray-800">env.timeout(5)</span></div>
        <div className="text-gray-800 mt-2">env.process(process(env))</div>
        <div className="text-gray-800 flex items-center gap-1">
          env.run() <div className="w-1.5 h-3 bg-gray-400 animate-pulse" />
        </div>
      </div>
      <div className="w-[100px] bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span className="text-[9px] font-bold text-gray-700 leading-tight">Simulation<br/>Running</span>
        </div>
        <div>
          <div className="text-[9px] text-gray-400">Time</div>
          <div className="text-[11px] font-bold text-gray-900 font-mono">{h}:{m}:{s}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-400">Events</div>
          <div className="text-[11px] font-bold text-gray-900 font-mono">{events.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};

const Card2Kpi = () => {
  const [tp, setTp] = useState(34);
  const [util, setUtil] = useState(68);
  const [wait, setWait] = useState(2.35);
  const [chartOffset, setChartOffset] = useState(0);

  useEffect(() => {
    const int = setInterval(() => {
      setTp(30 + Math.floor(Math.random() * 8));
      setUtil(65 + Math.floor(Math.random() * 10));
      setWait(Number((2.1 + Math.random() * 0.4).toFixed(2)));
    }, 2000);
    
    // Smooth scrolling chart animation
    let req: number;
    const animateChart = () => {
      setChartOffset(prev => (prev - 0.5) % 100);
      req = requestAnimationFrame(animateChart);
    };
    req = requestAnimationFrame(animateChart);
    
    return () => {
      clearInterval(int);
      cancelAnimationFrame(req);
    };
  }, []);

  return (
    <div className="bg-[#f8fafc] rounded-2xl p-4 border border-gray-100 flex flex-col gap-3 h-[180px]">
      <div className="flex gap-2">
        <div className="flex-1 bg-white rounded-lg border border-gray-100 p-2 transition-all">
          <div className="text-[8px] text-gray-400 mb-0.5">Throughput</div>
          <div className="text-[11px] font-bold text-gray-900 transition-colors">{tp} / min</div>
        </div>
        <div className="flex-1 bg-white rounded-lg border border-gray-100 p-2 transition-all">
          <div className="text-[8px] text-gray-400 mb-0.5">Utilization</div>
          <div className="text-[11px] font-bold text-gray-900 transition-colors">{util}%</div>
        </div>
        <div className="flex-1 bg-white rounded-lg border border-gray-100 p-2 transition-all">
          <div className="text-[8px] text-gray-400 mb-0.5">Avg. Wait</div>
          <div className="text-[11px] font-bold text-gray-900 transition-colors">{wait} min</div>
        </div>
      </div>
      <div className="flex-1 bg-white rounded-lg border border-gray-100 p-3 flex flex-col relative overflow-hidden">
        <div className="text-[9px] font-bold text-gray-700 mb-2 flex justify-between">
          Throughput Over Time
          <div className="flex gap-0.5 items-center">
            <span className="w-1 h-3 bg-green-500 rounded-sm animate-[bounce_1s_infinite]" />
            <span className="w-1 h-2 bg-green-500 rounded-sm animate-[bounce_1s_infinite_0.2s]" />
            <span className="w-1 h-4 bg-green-500 rounded-sm animate-[bounce_1s_infinite_0.4s]" />
          </div>
        </div>
        <div className="flex-1 relative mt-1 overflow-hidden">
          {/* Y Axis */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[7px] text-gray-400 z-10 bg-white/90 pr-1">
            <span>60</span><span>40</span><span>20</span><span>0</span>
          </div>
          {/* Chart Line with moving viewBox */}
          <svg className="absolute inset-0 w-full h-full ml-4" preserveAspectRatio="none" viewBox={`${-chartOffset} 0 100 100`}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Draw a repeating path so it loops */}
            <path d="M0,80 L10,60 L20,70 L30,40 L40,45 L50,20 L60,30 L70,35 L80,50 L90,20 L100,10 L110,60 L120,70 L130,40 L140,45 L150,20 L160,30 L170,35 L180,50 L190,20 L200,10" fill="none" stroke="#22c55e" strokeWidth="2" />
            <path d="M0,80 L10,60 L20,70 L30,40 L40,45 L50,20 L60,30 L70,35 L80,50 L90,20 L100,10 L110,60 L120,70 L130,40 L140,45 L150,20 L160,30 L170,35 L180,50 L190,20 L200,10 L200,100 L0,100 Z" fill="url(#chartGrad)" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const Card3Nodes = () => {
  const [nodes, setNodes] = useState({
    src: { x: 0, y: 120, title: "Source", icon: Play, col: "text-indigo-500", border: "border-l-indigo-500", bg: "bg-white" },
    queue: { x: 180, y: 120, title: "Queue", icon: List, col: "text-gray-500", border: "border-l-gray-400", bg: "bg-white" },
    m1: { x: 360, y: 30, title: "Machine 1", l1: "Util: 65%", icon: Cpu, col: "text-green-600", border: "border-l-green-500", bg: "bg-white" },
    m2: { x: 360, y: 120, title: "Machine 2", l1: "Util: 98% (Slow)", icon: AlertTriangle, col: "text-red-600", border: "border-l-red-500", bg: "bg-red-50" },
    m3: { x: 360, y: 210, title: "Machine 3", l1: "Util: 62%", icon: Cpu, col: "text-green-600", border: "border-l-green-500", bg: "bg-white" },
    sink: { x: 540, y: 120, title: "Sink", icon: Flag, col: "text-gray-500", border: "border-l-gray-400", bg: "bg-white" },
  });

  const scale = 0.35; // fit in tiny card

  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (key: string) => (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraggedNode(key);
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
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedNode) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      setDraggedNode(null);
    }
  };

  const bez = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
    const dx = Math.abs(p2.x - p1.x);
    return `M ${p1.x} ${p1.y} C ${p1.x + dx * 0.4} ${p1.y}, ${p1.x + dx * 0.6} ${p2.y}, ${p2.x} ${p2.y}`;
  };

  const conns = [
    { id: 'l1', from: 'src', to: 'queue', stroke: '#cbd5e1', dur: '1s' },
    { id: 'l2', from: 'queue', to: 'm1', stroke: '#cbd5e1', dur: '1.2s' },
    { id: 'l3', from: 'queue', to: 'm2', stroke: '#fca5a5', dur: '3.5s', slow: true },
    { id: 'l4', from: 'queue', to: 'm3', stroke: '#cbd5e1', dur: '1.1s' },
    { id: 'l5', from: 'm1', to: 'sink', stroke: '#cbd5e1', dur: '1s' },
    { id: 'l6', from: 'm2', to: 'sink', stroke: '#fca5a5', dur: '1s' },
    { id: 'l7', from: 'm3', to: 'sink', stroke: '#cbd5e1', dur: '1s' },
  ];

  return (
    <div 
      className="bg-[#f8fafc] rounded-2xl border border-gray-100 h-[180px] relative overflow-hidden flex items-center justify-center cursor-crosshair touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
       <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: `${24 * scale}px ${24 * scale}px`, backgroundPosition: 'center' }} />
       <div className="absolute inset-0 origin-center" style={{ transform: `scale(${scale})` }}>
          <div className="relative w-full h-full min-w-[700px] min-h-[300px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
             <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                {conns.map(c => (
                  <g key={c.id}>
                    <path 
                      d={bez(nodes[c.from as keyof typeof nodes], nodes[c.to as keyof typeof nodes])} 
                      stroke={c.stroke} strokeWidth="3" fill="none" 
                      className={c.slow ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}
                    />
                    <circle r="6" fill={c.stroke === '#cbd5e1' ? '#94a3b8' : '#ef4444'}>
                      <animateMotion dur={c.dur} repeatCount="indefinite" path={bez(nodes[c.from as keyof typeof nodes], nodes[c.to as keyof typeof nodes])} />
                    </circle>
                  </g>
                ))}
             </svg>
             {Object.entries(nodes).map(([key, node]) => (
                <div 
                  key={key}
                  onPointerDown={handlePointerDown(key)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-[140px] ${node.bg} rounded-3xl shadow-sm border border-gray-200 border-l-[6px] ${node.border} p-4 flex gap-4 items-center z-10 hover:shadow-lg transition-shadow select-none ${draggedNode === key ? 'cursor-grabbing scale-110 shadow-xl' : 'cursor-grab'}`}
                  style={{ left: `${node.x}px`, top: `${node.y}px`, touchAction: 'none' }}
                >
                  <div className={node.col}><node.icon size={24} /></div>
                  <div className="pointer-events-none">
                    <h5 className="text-[14px] font-bold text-gray-900 leading-tight">{node.title}</h5>
                    {node.l1 && <p className="text-[11px] font-bold text-gray-500 mt-1">{node.l1}</p>}
                  </div>
                </div>
             ))}
          </div>
       </div>
    </div>
  )
};

const Card4Speed = () => {
  const [speedMult, setSpeedMult] = useState(1);
  const [progress, setProgress] = useState(45);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setProgress(p => (p >= 100 ? 0 : p + speedMult));
    }, 100);
    return () => clearInterval(interval);
  }, [speedMult, isPaused]);

  return (
    <div className="bg-[#f8fafc] rounded-2xl p-5 border border-gray-100 h-[180px] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-700">Speed</span>
        <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
          <button onClick={() => setSpeedMult(1)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-colors ${speedMult === 1 ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-900'}`}>1x</button>
          <button onClick={() => setSpeedMult(5)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-colors ${speedMult === 5 ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-900'}`}>10x</button>
          <button onClick={() => setSpeedMult(15)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-colors ${speedMult === 15 ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-900'}`}>Max</button>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[11px] font-bold text-gray-700">Progress</span>
          <span className="text-[10px] font-bold text-gray-500">{Math.floor(progress)}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${progress}%`, transition: isPaused ? 'none' : 'width 100ms linear' }} />
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={() => setIsPaused(!isPaused)} className={`flex-1 border rounded-xl py-2 flex items-center justify-center gap-2 shadow-sm text-[11px] font-bold transition-colors ${isPaused ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
          {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />} {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={() => setProgress(p => Math.min(p + 10, 100))} className="flex-1 bg-white border border-gray-200 rounded-xl py-2 flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 text-[11px] font-bold text-gray-700 active:bg-gray-100">
          Step <StepForward size={12} fill="currentColor" />
        </button>
      </div>
    </div>
  );
};


/* --- Main Section Component --- */

export default function EngineSection() {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <section id="engine" className="relative py-24 md:py-32 px-4 bg-[#fcfcfd] font-sans overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-20 left-10 opacity-30 text-indigo-200" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '24px 24px', width: '200px', height: '200px' }} />
        <div className="absolute top-40 right-20 opacity-30 text-indigo-200" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '24px 24px', width: '250px', height: '250px' }} />
      </div>

      <div className="relative z-10 max-w-[1300px] mx-auto" ref={ref}>
        
        {/* --- HEADER --- */}
        <div className="flex flex-col items-center text-center mb-16 md:mb-20">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }} className="mb-4">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#5742FF] uppercase">SIMULATION ENGINE</span>
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay: 0.1 }} className="text-[2.5rem] md:text-[3.5rem] font-black leading-[1.1] text-[#111827] -tracking-[0.03em] mb-5">
            Speed & Precision <br className="md:hidden" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#5742FF] via-[#a855f7] to-[#f97316]">in Your Browser</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.5, delay: 0.2 }} className="max-w-xl text-[1.1rem] text-[#64748b] font-medium leading-relaxed">
            We bridge the gap between visual design and technical rigor by automatically generating and running Python's SimPy logic.
          </motion.p>
        </div>

        {/* --- CARDS GRID --- */}
        <motion.div variants={containerVariants} initial="hidden" animate={inView ? "show" : "hidden"} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          
          <motion.div variants={itemVariants} className="group relative bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 p-6 md:p-8 flex flex-col h-[480px]">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6"><Code2 size={24} strokeWidth={2} /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Pyodide & WebAssembly</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-8 flex-1">Run full simulations in-browser using Pyodide + WebAssembly. Zero server costs, full Python/SimPy execution.</p>
            <Card1Code />
          </motion.div>

          <motion.div variants={itemVariants} className="group relative bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 p-6 md:p-8 flex flex-col h-[480px]">
            <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-6"><BarChart3 size={24} strokeWidth={2} /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Real-time KPI Dashboards</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-8 flex-1">Live metrics and charts update as your simulation runs. Track throughput, utilization, wait time and more.</p>
            <Card2Kpi />
          </motion.div>

          <motion.div variants={itemVariants} className="group relative bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 p-6 md:p-8 flex flex-col h-[480px]">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-6"><AlertTriangle size={24} strokeWidth={2} /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Bottleneck Detection</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-8 flex-1">Automatically detect the slowest resources and highlight bottlenecks as your simulation progresses.</p>
            <Card3Nodes />
          </motion.div>

          <motion.div variants={itemVariants} className="group relative bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 p-6 md:p-8 flex flex-col h-[480px]">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-6"><Gauge size={24} strokeWidth={2} /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Smart Speed Control</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-8 flex-1">Control simulation speed with 1x, 10x, or max. Step through events or run freely to completion.</p>
            <Card4Speed />
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}
