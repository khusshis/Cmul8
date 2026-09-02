"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import { Sparkles, ArrowRight, Mouse, BarChart3 } from "lucide-react";

// --- LEFT CARD COMPONENT ---
function MiniCanvas() {
  const blueX = useMotionValue(20);
  const blueY = useMotionValue(30);
  
  const greenX = useMotionValue(90);
  const greenY = useMotionValue(68);
  
  const purpleX = useMotionValue(130);
  const purpleY = useMotionValue(38);

  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");

  const updateLines = () => {
    setLine1(`M ${blueX.get() + 45} ${blueY.get() + 12} Q 100 55 ${purpleX.get()} ${purpleY.get() + 12}`);
    setLine2(`M ${blueX.get() + 45} ${blueY.get() + 12} Q 75 75 ${greenX.get()} ${greenY.get() + 10}`);
  };

  useEffect(() => {
    updateLines();
    const unsubs = [
      blueX.on("change", updateLines),
      blueY.on("change", updateLines),
      greenX.on("change", updateLines),
      greenY.on("change", updateLines),
      purpleX.on("change", updateLines),
      purpleY.on("change", updateLines),
    ];
    return () => unsubs.forEach(unsub => unsub && unsub());
  }, []);

  return (
    <svg className="w-full h-full relative z-10" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadowLeft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#8b5cf6" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Dynamic Connection Lines */}
      <path d={line1} fill="none" stroke="#b2bdf9" strokeWidth="1.5" />
      <path d={line2} fill="none" stroke="#b2bdf9" strokeWidth="1.5" strokeDasharray="3 3" />

      {/* Interactive Draggable Nodes */}
      <motion.g style={{ x: blueX, y: blueY }} drag dragMomentum={false} dragConstraints={{ top: 0, left: 0, right: 150, bottom: 110 }}>
        <motion.rect 
          x="0" y="0" width="45" height="24" rx="12" fill="#dce5ff" stroke="#ffffff" strokeWidth="4" filter="url(#shadowLeft)" 
          whileHover={{ scale: 1.08 }} whileDrag={{ scale: 1.15 }} style={{ originX: "22.5px", originY: "12px" }}
          className="cursor-grab active:cursor-grabbing"
        />
      </motion.g>

      <motion.g style={{ x: greenX, y: greenY }} drag dragMomentum={false} dragConstraints={{ top: 0, left: 0, right: 155, bottom: 115 }}>
        <motion.rect 
          x="0" y="0" width="40" height="20" rx="10" fill="#bcf5d6" stroke="#ffffff" strokeWidth="4" filter="url(#shadowLeft)" 
          whileHover={{ scale: 1.08 }} whileDrag={{ scale: 1.15 }} style={{ originX: "20px", originY: "10px" }}
          className="cursor-grab active:cursor-grabbing"
        />
      </motion.g>

      <motion.g style={{ x: purpleX, y: purpleY }} drag dragMomentum={false} dragConstraints={{ top: 0, left: 0, right: 145, bottom: 110 }}>
        <motion.rect 
          x="0" y="0" width="50" height="24" rx="12" fill="#ebdfff" stroke="#ffffff" strokeWidth="4" filter="url(#shadowLeft)" 
          whileHover={{ scale: 1.08 }} whileDrag={{ scale: 1.15 }} style={{ originX: "25px", originY: "12px" }}
          className="cursor-grab active:cursor-grabbing"
        />
      </motion.g>
    </svg>
  );
}

// --- RIGHT CARD COMPONENT ---
function LiveResultsCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  // Live simulation data state
  const [stats, setStats] = useState({ t: 120, u: 78, w: 2.4 });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        t: 120 + Math.floor(Math.random() * 8) - 4,
        u: 78 + Math.floor(Math.random() * 6) - 3,
        w: Number((2.4 + (Math.random() * 0.4 - 0.2)).toFixed(1))
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    setRotateX(((y - centerY) / centerY) * -10);
    setRotateY(((x - centerX) / centerX) * 10);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div className="relative">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={{ rotateX, rotateY }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{ perspective: 1000, transformStyle: "preserve-3d" }}
        className="bg-[#ffffff] rounded-[2rem] p-6 w-[340px] shadow-[0_25px_50px_rgba(139,92,246,0.12)] border border-white"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-[14px] bg-[#f5f3ff] text-[#8b5cf6] flex items-center justify-center border border-violet-100/50 shadow-inner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
          </div>
          <span className="font-bold text-[#1e293b] text-[17px] tracking-tight">Live Results</span>
        </div>

        {/* Chart Graphic with animated glowing dot */}
        <div className="h-24 w-full mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#f8faff] to-white border border-indigo-50/50">
          <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 300 80">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(139, 92, 246, 0.25)" />
                <stop offset="100%" stopColor="rgba(139, 92, 246, 0.0)" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <path d="M0,80 L0,50 C100,20 200,80 300,45 L300,80 Z" fill="url(#chartGradient)" />
            <path d="M0,50 C100,20 200,80 300,45" fill="none" stroke="#8b5cf6" strokeWidth="2.5" />
            
            {/* Live Sweeping Tracker */}
            <circle r="4" fill="#ffffff" stroke="#8b5cf6" strokeWidth="2" filter="url(#glow)">
              <animateMotion dur="4s" repeatCount="indefinite" path="M0,50 C100,20 200,80 300,45" />
            </circle>
          </svg>
        </div>

        {/* Interactive Stats Row */}
        <div className="flex gap-3 justify-between">
          <motion.div whileHover={{ y: -4, scale: 1.02 }} className="bg-white rounded-2xl p-3 flex-1 text-center border border-[#f1f5f9] shadow-[0_4px_15px_rgba(0,0,0,0.03)] cursor-default">
            <div className="text-[9px] text-[#94a3b8] font-bold tracking-wider mb-1.5 uppercase">Throughput</div>
            <motion.div key={stats.t} initial={{ scale: 1.1, color: "#8b5cf6" }} animate={{ scale: 1, color: "#1e293b" }} className="text-[17px] font-black">{stats.t}/h</motion.div>
          </motion.div>
          
          <motion.div whileHover={{ y: -4, scale: 1.02 }} className="bg-white rounded-2xl p-3 flex-1 text-center border border-[#f1f5f9] shadow-[0_4px_15px_rgba(0,0,0,0.03)] cursor-default">
            <div className="text-[9px] text-[#94a3b8] font-bold tracking-wider mb-1.5 uppercase">Utilization</div>
            <motion.div key={stats.u} initial={{ scale: 1.1, color: "#8b5cf6" }} animate={{ scale: 1, color: "#1e293b" }} className="text-[17px] font-black">{stats.u}%</motion.div>
          </motion.div>
          
          <motion.div whileHover={{ y: -4, scale: 1.02 }} className="bg-white rounded-2xl p-3 flex-1 text-center border border-[#f1f5f9] shadow-[0_4px_15px_rgba(0,0,0,0.03)] cursor-default">
            <div className="text-[9px] text-[#94a3b8] font-bold tracking-wider mb-1.5 uppercase">Wait Time</div>
            <motion.div key={stats.w} initial={{ scale: 1.1, color: "#8b5cf6" }} animate={{ scale: 1, color: "#1e293b" }} className="text-[17px] font-black">{stats.w} min</motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Hand-drawn arrow & text */}
      <div className="absolute -bottom-8 right-0 flex items-center gap-2 text-[#7c3aed] font-semibold text-[14px] rotate-[-6deg] pointer-events-none">
        <div className="bg-[#f5f3ff] px-4 py-2 rounded-full shadow-sm border border-violet-100 flex items-center gap-2">
          <BarChart3 size={14} strokeWidth={2.5} />
          Track & Optimize
        </div>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transform scale-y-100 -scale-x-100 opacity-70">
          <path d="M4 12S8 4 20 4M20 4L14 10M20 4L16 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}


export default function HeroSection() {
  return (
    <section className="relative flex flex-col items-center pt-32 md:pt-40 pb-20 md:pb-32 overflow-hidden bg-[#fafaff] font-sans">
      
      {/* --- BACKGROUND GRADIENTS (Ultra-soft & Premium) --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[15%] -left-[10%] w-[55vw] max-w-[800px] h-[55vw] max-h-[800px] rounded-full bg-[#d6ccff]/30 blur-[140px]" />
        <div className="absolute top-[5%] -right-[15%] w-[50vw] max-w-[700px] h-[50vw] max-h-[700px] rounded-full bg-[#e0d6ff]/40 blur-[130px]" />
        
        <div className="absolute bottom-0 left-[10%] w-[60vw] max-w-[900px] h-[60vw] max-h-[900px] rounded-full bg-[#cbd5e1]/15 blur-[120px]" />
        <div className="absolute bottom-10 right-[10%] w-[60vw] max-w-[900px] h-[60vw] max-h-[900px] rounded-full bg-[#d8b4fe]/15 blur-[120px]" />
        
        {/* Subtle mesh/noise overlay to make gradients look high-end */}
        <div 
          className="absolute inset-0 mix-blend-overlay opacity-[0.15]" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 flex flex-col items-center">
        
        {/* WE CREATE A RELATIVE WRAPPER FOR THE CORE CONTENT + CARDS */}
        <div className="relative w-full flex flex-col items-center">
          
          {/* --- FLOATING CARDS (Shifted down to flank the narrower subhead and prompt bar instead of the massive headline) --- */}
          {/* Left Card */}
          <motion.div
            initial={{ opacity: 0, x: -60, y: 20, rotate: -6 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: -3 }}
            transition={{ duration: 1, delay: 0.4, type: "spring", bounce: 0.4 }}
            className="hidden lg:block absolute top-[260px] right-[calc(50%+330px)] xl:right-[calc(50%+390px)] 2xl:right-[calc(50%+440px)] scale-75 xl:scale-90 2xl:scale-100 origin-right z-40"
          >
            <div className="relative">
              <div className="absolute -top-4 -right-4 text-violet-400 opacity-60 pointer-events-none">✦</div>
              
              <motion.div
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                style={{ perspective: 1000, transformStyle: "preserve-3d" }}
                className="bg-[#ffffff] rounded-[2rem] p-6 w-[280px] h-[210px] shadow-[0_25px_50px_rgba(139,92,246,0.12)] flex items-center justify-center relative border border-white overflow-visible"
              >
                <MiniCanvas />
              </motion.div>

              {/* Hand-drawn arrow & text */}
              <div className="absolute -bottom-8 -left-4 flex items-center gap-2 text-[#8b5cf6] font-medium text-sm rotate-[4deg] pointer-events-none">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transform -scale-y-100 scale-x-100 opacity-80">
                  <path d="M4 12S8 4 20 4M20 4L14 10M20 4L16 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-base font-bold">Drag & Connect</span>
              </div>
            </div>
          </motion.div>

          {/* Right Card: Live Results */}
          <motion.div
            initial={{ opacity: 0, x: 60, y: 20, rotate: 6 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 3 }}
            transition={{ duration: 1, delay: 0.5, type: "spring", bounce: 0.4 }}
            className="hidden lg:block absolute top-[340px] left-[calc(50%+330px)] xl:left-[calc(50%+390px)] 2xl:left-[calc(50%+440px)] scale-75 xl:scale-90 2xl:scale-100 origin-left z-40"
          >
            <LiveResultsCard />
          </motion.div>

          {/* --- BADGE --- */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", type: "spring", bounce: 0.5 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-200/50 bg-white/70 backdrop-blur-md mb-6 md:mb-10 shadow-[0_4px_20px_rgba(139,92,246,0.12)] relative z-30"
          >
            <Sparkles size={14} className="text-[#6366f1]" />
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#6366f1] uppercase">
              NO CODE · BROWSER BASED · FREE FOREVER
            </span>
          </motion.div>

          {/* --- HEADLINE --- */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, type: "spring", bounce: 0.4 }}
            className="text-center max-w-4xl mx-auto mb-4 md:mb-6 relative z-30 pointer-events-none"
          >
            <h1 className="text-[3.5rem] sm:text-[4rem] lg:text-[5rem] 2xl:text-[6rem] font-space font-black leading-[1.05] text-[#161622] -tracking-[0.035em]">
              Build Simulations.<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#8b5cf6] to-[#6366f1]">
                No Limits.
              </span>
            </h1>
          </motion.div>

          {/* --- SUBHEAD --- */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-center text-[1rem] sm:text-[1.1rem] md:text-[1.25rem] text-[#64748b] max-w-2xl mx-auto mb-8 md:mb-16 font-medium leading-relaxed relative z-30 px-4"
          >
            Create, run and analyze discrete event simulations — visually, 
            with no code, and right in your browser.
          </motion.p>

          {/* --- AI PROMPT BAR --- */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3, type: "spring", bounce: 0.4 }}
            className="w-full max-w-2xl 2xl:max-w-3xl relative mb-16 md:mb-24 z-30 px-4"
          >
            {/* Enhanced Outer glow */}
            <div className="absolute inset-4 md:-inset-1 rounded-full bg-gradient-to-r from-violet-400/20 via-indigo-400/20 to-violet-400/20 blur-[24px]" />
            
            <div className="relative flex flex-col sm:flex-row items-center bg-white/95 backdrop-blur-xl border border-white shadow-[0_8px_40px_rgba(139,92,246,0.15)] rounded-[2rem] sm:rounded-full p-2 pl-4 sm:pl-6 gap-2 sm:gap-0">
              <div className="flex items-center w-full px-2 sm:px-0 py-2 sm:py-0">
                <Sparkles size={20} className="text-[#8b5cf6] mr-3 shrink-0" />
                <input 
                  type="text" 
                  placeholder="Describe your simulation..."
                  className="flex-1 bg-transparent border-none outline-none text-[#334155] placeholder:text-[#94a3b8] font-medium text-[15px]"
                />
              </div>
              <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#7c3aed] hover:to-[#4f46e5] text-white px-7 py-3 sm:py-3.5 rounded-[1.5rem] sm:rounded-full font-bold transition-all shadow-[0_4px_15px_rgba(139,92,246,0.3)] shrink-0 text-sm">
                Generate with AI
                <ArrowRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </motion.div>
          
        </div>

        {/* --- TRUSTED BY --- */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="w-full text-center mt-4 md:mt-12 z-10"
        >
          <p className="text-[10px] md:text-xs font-bold tracking-[0.2em] text-[#94a3b8] uppercase mb-8 md:mb-10">
            TRUSTED BY INNOVATORS
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-16 opacity-[0.45] grayscale hover:grayscale-0 transition-all duration-500">
            <span className="font-black text-lg md:text-xl tracking-tighter">DAZZ.</span>
            <span className="font-bold text-base md:text-lg flex items-center gap-1.5"><div className="w-3 h-3 md:w-3.5 md:h-3.5 bg-gray-500 rotate-45" />MULTIPLE</span>
            <span className="font-semibold text-base md:text-lg flex items-center gap-1.5"><div className="w-4 h-3 md:w-5 md:h-3.5 border-2 border-gray-500 rounded-sm" /> CLOUDBOLT</span>
            <span className="font-black text-lg md:text-xl tracking-widest italic">VOLT</span>
            <span className="font-medium text-lg md:text-xl">Cayosoft</span>
            <span className="font-bold text-lg md:text-xl tracking-wider">TRILIO</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
