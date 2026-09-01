"use client";

import React, { useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { User, Car, Droplet, Factory, Package, Radio, ArrowRight, ChevronRight, Plus, Star } from "lucide-react";
import Link from "next/link";

const simTypes = [
  { 
    id: "human", name: "Human Queue", desc: "Bank, Hospital, Airport", 
    hex: "#16a34a", bg: "bg-green-50", text: "text-green-600", border: "border-green-600", 
    icon: User, examples: ["Bank tellers", "ER triage", "Passport control"] 
  },
  { 
    id: "vehicle", name: "Vehicle", desc: "Gas Station, Traffic", 
    hex: "#2563eb", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-600", 
    icon: Car, examples: ["Fuel pumps", "Traffic lights", "Car wash"] 
  },
  { 
    id: "liquid", name: "Liquid / Material", desc: "Water Treatment, Pipelines", 
    hex: "#06b6d4", bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-500", 
    icon: Droplet, examples: ["Water treatment", "Fuel storage", "Chemical flow"] 
  },
  { 
    id: "mfg", name: "Manufacturing", desc: "Assembly Line, QC", 
    hex: "#eab308", bg: "bg-yellow-50", text: "text-yellow-500", border: "border-yellow-500", 
    icon: Factory, examples: ["Assembly line", "Quality control", "CNC machining"] 
  },
  { 
    id: "logistics", name: "Logistics", desc: "Warehouse, Sorting", 
    hex: "#f97316", bg: "bg-orange-50", text: "text-orange-500", border: "border-orange-500", 
    icon: Package, examples: ["Warehouse ops", "Sort centers", "Dock loading"] 
  },
  { 
    id: "network", name: "Network", desc: "Microservices, IoT", 
    hex: "#ec4899", bg: "bg-pink-50", text: "text-pink-500", border: "border-pink-500", 
    icon: Radio, examples: ["Process pipes", "Broadcast fan-out", "Event latency"] 
  },
];

export default function SimTypesSection() {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <section id="simulations" className="relative py-24 md:py-32 px-4 bg-[#fcfcfd] font-sans overflow-hidden border-t border-gray-100">
      
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-20 left-10 opacity-30 text-indigo-200" style={{ backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.5px)', backgroundSize: '30px 30px', width: '250px', height: '250px' }} />
        <div className="absolute top-10 right-[-10%] w-[60vw] max-w-[800px] h-[60vw] max-h-[800px] rounded-full border-[1px] border-pink-100/50 blur-[2px]" />
        <div className="absolute top-20 right-[-5%] w-[50vw] max-w-[600px] h-[50vw] max-h-[600px] rounded-full border-[1px] border-orange-100/50 blur-[2px]" />
        <div className="absolute top-40 right-10 w-[30vw] max-w-[400px] h-[30vw] max-h-[400px] rounded-full bg-gradient-to-tr from-pink-50/40 to-orange-50/40 blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto" ref={ref}>
        
        {/* --- HEADER --- */}
        <div className="flex flex-col items-center text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-50 mb-6 border border-orange-100"
          >
            <span className="text-[10px] font-bold tracking-[0.2em] text-orange-500 uppercase">
              SIMULATION TYPES
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[2.5rem] md:text-[3.5rem] font-black leading-[1.1] text-[#111827] -tracking-[0.03em] mb-5"
          >
            Visualize <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#5742FF] to-[#f97316]">Any Industry</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl text-[1.1rem] text-[#64748b] font-medium leading-relaxed"
          >
            Choose your simulation context. Each type comes with curated 2D sprite assets for realistic, animated visualization.
          </motion.p>
        </div>

        {/* --- CARDS GRID --- */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 mb-12"
        >
          {simTypes.map((type, i) => (
            <Card type={type} key={type.id} />
          ))}
        </motion.div>

        {/* --- BOTTOM TEXT --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-gray-500 font-medium"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center"><Plus size={12} strokeWidth={3} /></div>
            Extensible: More types added regularly.
          </div>
          <div className="hidden sm:block text-gray-300">|</div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">
            <Star size={12} fill="currentColor" /> Custom Types on Pro
          </div>
        </motion.div>

      </div>
    </section>
  );
}

const Card = ({ type }: { type: any }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
      }}
      whileHover={{ y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-shadow duration-300 flex flex-col h-[380px] overflow-hidden cursor-pointer border border-gray-100"
    >
      {/* Colored Top Border Indicator */}
      <div className={`absolute top-0 left-4 right-4 h-[4px] rounded-b-md ${type.bg} ${type.border} border-t-[4px] opacity-70 group-hover:opacity-100 transition-opacity`} />
      
      <div className="p-6 flex flex-col h-full z-10 pt-8">
        
        {/* Bouncing Icon */}
        <motion.div 
          animate={isHovered ? { y: [0, -6, 0] } : { y: 0 }}
          transition={{ duration: 1.5, repeat: isHovered ? Infinity : 0, ease: "easeInOut" }}
          className={`w-14 h-14 rounded-2xl ${type.bg} ${type.text} flex items-center justify-center mb-5 shadow-inner`}
        >
          <type.icon size={26} strokeWidth={2} />
        </motion.div>

        <h3 className="text-lg font-bold text-gray-900 mb-1.5 tracking-tight">{type.name}</h3>
        <p className="text-[11px] text-gray-500 font-medium mb-6">{type.desc}</p>
        
        {/* Bullet Points with Staggered Hover Effect */}
        <ul className="space-y-3 w-full flex-1">
          {type.examples.map((ex: string, idx: number) => (
            <motion.li 
              key={ex} 
              initial={{ x: 0, opacity: 0.8 }}
              animate={isHovered ? { x: 5, opacity: 1 } : { x: 0, opacity: 0.8 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              className="text-[12px] text-gray-600 font-medium flex items-center gap-2"
            >
              <span className={`w-1 h-1 rounded-full ${type.bg} border ${type.border}`} style={{ backgroundColor: type.hex }} />
              {ex}
            </motion.li>
          ))}
        </ul>

        {/* Try Button */}
        <Link href="/signup" className="flex items-center justify-between mt-auto pt-4 group/btn">
          <span className={`text-[13px] font-bold transition-colors`} style={{ color: type.hex }}>
            Try
          </span>
          <motion.div 
            animate={isHovered ? { scale: 1.1, backgroundColor: type.hex, color: "#fff" } : { scale: 1, backgroundColor: "#f8fafc", color: type.hex }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border border-transparent group-hover/btn:border-gray-100`}
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </motion.div>
        </Link>
      </div>

    </motion.div>
  );
};
