"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Users, Layers, Server, Flag } from 'lucide-react';

export function AuthDiagram() {
  return (
    <div className="relative flex-grow flex items-center justify-center min-h-[180px] w-full max-w-[500px] mx-auto z-10 my-2 lg:my-4">
      {/* SVG Path - Continuously Moving (Marching Ants) */}
      <svg 
        className="absolute w-full h-full inset-0 pointer-events-none" 
        style={{ top: '50%', transform: 'translateY(-50%)' }}
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
      >
         <motion.path 
            animate={{ strokeDashoffset: [0, -12] }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            d="M 10 50 Q 25 30, 40 50 T 70 50 T 90 50" 
            fill="none" stroke="#A78BFA" strokeWidth="2" strokeDasharray="6,6" 
            vectorEffect="non-scaling-stroke"
         />
      </svg>
      {/* Pulsing connection dots as HTML elements */}
      {[
        { left: "10%", top: "50%", delay: 0 },
        { left: "37%", top: "43%", delay: 0.4 },
        { left: "65%", top: "57%", delay: 0.8 },
        { left: "90%", top: "50%", delay: 1.2 }
      ].map((dot, i) => (
        <motion.div 
           key={i}
           className="absolute w-2 h-2 bg-[#A78BFA] rounded-full z-10"
           style={{ left: dot.left, top: dot.top, x: '-50%', y: '-50%' }}
           animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }}
           transition={{ repeat: Infinity, duration: 2, delay: dot.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Nodes Container */}
      <div className="w-full flex justify-between items-center relative px-[5%] max-w-[500px]">
        
        {/* Stat Card - Avg Wait Time */}
        <motion.div 
          animate={{ y: [-5, 5] }}
          transition={{ repeat: Infinity, repeatType: "mirror", duration: 3, ease: "easeInOut" }}
          style={{ willChange: "transform" }}
          className="absolute left-0 bottom-[-50px] bg-white p-2.5 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.06)] border border-gray-100 hidden md:flex flex-col w-[110px] z-20"
        >
          <span className="text-[9px] text-gray-500 font-medium mb-0.5 uppercase tracking-wider">Avg. Wait Time</span>
          <span className="text-base font-bold text-[#111827]">4.2 min</span>
          <span className="text-[10px] font-bold text-[#10B981] flex items-center">↓ 5.1%</span>
        </motion.div>

        {/* Source Node */}
        <div className="flex flex-col items-center gap-1.5 z-10">
          <motion.div 
            animate={{ y: [-3, 3] }}
            transition={{ repeat: Infinity, repeatType: "mirror", duration: 2.5, ease: "easeInOut", delay: 0.2 }}
            style={{ willChange: "transform" }}
            className="w-14 h-14 lg:w-16 lg:h-16 bg-[#8B7CF6] rounded-2xl shadow-[0_8px_16px_rgba(139,124,246,0.3)] flex items-center justify-center text-white"
          >
            <Users size={26} />
          </motion.div>
          <span className="text-[12px] font-semibold text-[#111827]">Source</span>
        </div>

        {/* Stat Card - Throughput */}
        <motion.div 
          animate={{ y: [5, -5] }}
          transition={{ repeat: Infinity, repeatType: "mirror", duration: 3.2, ease: "easeInOut", delay: 0.5 }}
          style={{ willChange: "transform" }}
          className="absolute right-[25%] top-[-45px] bg-white p-2.5 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.06)] border border-gray-100 hidden md:flex flex-col w-[110px] z-20"
        >
          <span className="text-[9px] text-gray-500 font-medium mb-0.5 uppercase tracking-wider">Throughput</span>
          <span className="text-base font-bold text-[#111827]">1,240</span>
          <span className="text-[10px] font-bold text-[#10B981] flex items-center">↑ 12.3%</span>
        </motion.div>

        {/* Queue Node */}
        <div className="flex flex-col items-center gap-1.5 z-10 translate-y-[-15px]">
          <motion.div 
            animate={{ y: [-3, 3] }}
            transition={{ repeat: Infinity, repeatType: "mirror", duration: 2.7, ease: "easeInOut", delay: 0.6 }}
            style={{ willChange: "transform" }}
            className="w-14 h-14 lg:w-16 lg:h-16 bg-[#5B93F0] rounded-2xl shadow-[0_8px_16px_rgba(91,147,240,0.3)] flex items-center justify-center text-white"
          >
            <Layers size={26} />
          </motion.div>
          <span className="text-[12px] font-semibold text-[#111827]">Queue</span>
        </div>

        {/* Server Node */}
        <div className="flex flex-col items-center gap-1.5 z-10 translate-y-[15px]">
          <motion.div 
            animate={{ y: [-3, 3] }}
            transition={{ repeat: Infinity, repeatType: "mirror", duration: 2.4, ease: "easeInOut", delay: 1 }}
            style={{ willChange: "transform" }}
            className="w-14 h-14 lg:w-16 lg:h-16 bg-[#2FD1B4] rounded-2xl shadow-[0_8px_16px_rgba(47,209,180,0.3)] flex items-center justify-center text-white"
          >
            <Server size={26} />
          </motion.div>
          <span className="text-[12px] font-semibold text-[#111827]">Server</span>
        </div>

        {/* Stat Card - Utilization */}
        <motion.div 
          animate={{ y: [-4, 4] }}
          transition={{ repeat: Infinity, repeatType: "mirror", duration: 3.5, ease: "easeInOut", delay: 1 }}
          style={{ willChange: "transform" }}
          className="absolute right-[5%] bottom-[-55px] bg-white p-2.5 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.06)] border border-gray-100 hidden md:flex flex-col items-center justify-center w-[85px] h-[85px] lg:w-[95px] lg:h-[95px] z-20"
        >
          <span className="text-[8px] text-gray-500 font-medium mb-1 uppercase tracking-wider">Utilization</span>
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#E5E7EB" strokeWidth="4" />
              {/* Pulsing ring */}
              <motion.circle 
                 animate={{ strokeDashoffset: [22, 10, 22] }}
                 transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                 cx="20" cy="20" r="16" fill="none" stroke="#2FD1B4" strokeWidth="4" strokeDasharray="100" strokeLinecap="round" 
              />
            </svg>
            <span className="absolute text-[12px] font-bold text-[#111827]">78%</span>
          </div>
        </motion.div>

        {/* Sink Node */}
        <div className="flex flex-col items-center gap-1.5 z-10">
          <motion.div 
            animate={{ y: [-3, 3] }}
            transition={{ repeat: Infinity, repeatType: "mirror", duration: 2.8, ease: "easeInOut", delay: 1.4 }}
            style={{ willChange: "transform" }}
            className="w-14 h-14 lg:w-16 lg:h-16 bg-[#E4DEFB] rounded-2xl shadow-[0_8px_16px_rgba(228,222,251,0.5)] flex items-center justify-center text-[#6C5CE7]"
          >
            <Flag size={26} />
          </motion.div>
          <span className="text-[12px] font-semibold text-[#111827]">Sink</span>
        </div>

      </div>
    </div>
  );
}
