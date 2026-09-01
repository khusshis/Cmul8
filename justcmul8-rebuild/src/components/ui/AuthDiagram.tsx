"use client";
import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Shield, Ticket, Train } from 'lucide-react';

const initialNodes = {
  source: { x: 50, y: 150, title: 'Station Entrance', l1: 'rate: 150/min', icon: Users, col: 'text-purple-500', border: 'border-l-purple-500' },
  queue: { x: 200, y: 80, title: 'Security Check', l1: 'capacity: 4 lines', icon: Shield, col: 'text-blue-500', border: 'border-l-blue-500' },
  server: { x: 350, y: 220, title: 'Ticket Counter', l1: 'service: 30s', icon: Ticket, col: 'text-green-500', border: 'border-l-green-500' },
  sink: { x: 500, y: 150, title: 'Platform Boarding', l1: 'status: waiting', icon: Train, col: 'text-indigo-500', border: 'border-l-indigo-500' },
};

const connections = [
  { id: 'c1', from: 'source', to: 'queue' },
  { id: 'c2', from: 'queue', to: 'server' },
  { id: 'c3', from: 'server', to: 'sink' },
];

export function AuthDiagram() {
  const [nodes, setNodes] = useState(initialNodes);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (key: string) => (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDraggedNode(key);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggedNode) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
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
    const midX1 = p1.x + dx * 0.4;
    const midX2 = p1.x + dx * 0.6;
    return `M ${p1.x} ${p1.y} C ${midX1} ${p1.y}, ${midX2} ${p2.y}, ${p2.x} ${p2.y}`;
  };

  return (
    <div 
      className="relative flex-grow flex items-center justify-center w-full h-full min-h-[300px] max-w-[600px] mx-auto z-10 touch-none overflow-visible"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="relative w-[550px] h-[300px] origin-center scale-[0.6] sm:scale-[0.8] md:scale-90 lg:scale-100 transition-transform">
        
        {/* Dynamic SVG Connections */}
        <svg 
          className="absolute inset-0 pointer-events-none" 
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          {connections.map(conn => {
            const n1 = nodes[conn.from as keyof typeof nodes];
            const n2 = nodes[conn.to as keyof typeof nodes];
            return (
              <motion.path 
                key={conn.id}
                animate={{ strokeDashoffset: [0, -12] }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                d={bez(n1, n2)} 
                fill="none" 
                stroke="#cbd5e1" 
                strokeWidth="1.5" 
                strokeDasharray="6,6" 
              />
            );
          })}
        </svg>
        
        {/* HTML Draggable Nodes */}
        {Object.entries(nodes).map(([key, node]) => (
          <div
            key={key}
            onPointerDown={handlePointerDown(key)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-[125px] sm:w-[135px] bg-white rounded-xl shadow-md border border-gray-200 border-l-4 ${node.border} p-2.5 flex gap-2.5 items-center z-20 hover:shadow-lg transition-shadow select-none ${draggedNode === key ? 'cursor-grabbing scale-105 shadow-xl z-50' : 'cursor-grab'}`}
            style={{ left: `${node.x}px`, top: `${node.y}px`, touchAction: 'none' }}
          >
            <div className={node.col}><node.icon size={16} /></div>
            <div className="pointer-events-none">
              <h5 className="text-[10px] sm:text-[11px] font-bold text-gray-900 leading-tight">{node.title}</h5>
              {node.l1 && <p className="text-[8px] sm:text-[9px] text-gray-500 mt-0.5">{node.l1}</p>}
            </div>
          </div>
        ))}

        {/* Stat Card - Avg Wait Time */}
        <motion.div 
          drag
          whileDrag={{ scale: 1.05, cursor: "grabbing", zIndex: 50 }}
          animate={{ y: [-4, 4] }}
          transition={{ repeat: Infinity, repeatType: "mirror", duration: 3, ease: "easeInOut" }}
          className="absolute left-[30px] bottom-[20px] bg-white p-2.5 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.06)] border border-gray-100 hidden md:flex flex-col w-[110px] z-30 cursor-grab"
        >
          <span className="text-[9px] text-gray-500 font-medium mb-0.5 uppercase tracking-wider pointer-events-none">Avg. Wait Time</span>
          <span className="text-base font-bold text-[#111827] pointer-events-none">4.2 min</span>
          <span className="text-[10px] font-bold text-[#10B981] flex items-center pointer-events-none">↓ 5.1%</span>
        </motion.div>

        {/* Stat Card - Throughput */}
        <motion.div 
          drag
          whileDrag={{ scale: 1.05, cursor: "grabbing", zIndex: 50 }}
          animate={{ y: [4, -4] }}
          transition={{ repeat: Infinity, repeatType: "mirror", duration: 3.2, ease: "easeInOut", delay: 0.5 }}
          className="absolute right-[30px] top-[20px] bg-white p-2.5 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.06)] border border-gray-100 hidden md:flex flex-col w-[110px] z-30 cursor-grab"
        >
          <span className="text-[9px] text-gray-500 font-medium mb-0.5 uppercase tracking-wider pointer-events-none">Throughput</span>
          <span className="text-base font-bold text-[#111827] pointer-events-none">1,240</span>
          <span className="text-[10px] font-bold text-[#10B981] flex items-center pointer-events-none">↑ 12.3%</span>
        </motion.div>
      </div>
    </div>
  );
}
