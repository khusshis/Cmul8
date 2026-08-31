"use client";

import React from "react";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimTypeId, NodeType } from "@/lib/simulation/types";
import { X, ChevronUp, Plus } from "lucide-react";

export interface NodePaletteProps {
  simType: string;
  onAddNode: (type: string) => void;
}

const CATEGORY_COLORS: Record<string, { text: string, bg: string, iconBg: string }> = {
  CORE: { text: "text-[#4f46e5]", bg: "bg-[#4f46e5]", iconBg: "bg-[#eef2ff]" },
  RESOURCES: { text: "text-[#16a34a]", bg: "bg-[#16a34a]", iconBg: "bg-[#f0fdf4]" },
  ROUTING: { text: "text-[#2563eb]", bg: "bg-[#2563eb]", iconBg: "bg-[#eff6ff]" },
  ADVANCED: { text: "text-[#ea580c]", bg: "bg-[#ea580c]", iconBg: "bg-[#fff7ed]" },
};

export default function NodePalette({ simType, onAddNode }: NodePaletteProps) {
  const simConfig = SIM_TYPE_REGISTRY[simType as SimTypeId] || SIM_TYPE_REGISTRY.human_queue;
  const paletteNodes = simConfig.paletteNodes || [];

  function onDragStart(e: React.DragEvent, nodeType: string) {
    e.dataTransfer.setData("application/reactflow", nodeType);
    e.dataTransfer.effectAllowed = "move";
  }

  const categories = [
    {
      id: "CORE",
      nodes: paletteNodes.filter((n) => ["source", "queue", "service", "sink"].includes(n.type)),
    },
    {
      id: "RESOURCES",
      nodes: paletteNodes.filter((n) => ["resource", "priority_resource"].includes(n.type)),
    },
    {
      id: "ROUTING",
      nodes: paletteNodes.filter((n) => ["decision", "channel", "broadcaster"].includes(n.type)),
    },
    {
      id: "ADVANCED",
      nodes: paletteNodes.filter((n) => !["source", "queue", "service", "sink", "resource", "priority_resource", "decision", "channel", "broadcaster"].includes(n.type)),
    }
  ];

  return (
    <div className="w-[280px] border-r border-border bg-surface h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-text-primary">Block Palette</h2>
        <button className="p-1 hover:bg-bg-surface-sunken rounded-md text-text-secondary transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Scrollable Node List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        {categories.map((cat) => {
          if (cat.nodes.length === 0) return null;
          
          const theme = CATEGORY_COLORS[cat.id] || CATEGORY_COLORS.CORE;
          
          return (
            <div key={cat.id} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className={`text-[11px] font-bold tracking-widest uppercase ${theme.text}`}>
                  {cat.id}
                </h3>
                <ChevronUp size={14} className={theme.text} />
              </div>

              <div className="border border-border/80 rounded-[14px] bg-surface shadow-sm overflow-hidden">
                {cat.nodes.map((n, idx) => {
                  const isLast = idx === cat.nodes.length - 1;
                  return (
                    <div
                      key={n.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, n.type)}
                      className={`p-3.5 flex items-start gap-3.5 cursor-grab active:cursor-grabbing hover:bg-bg-surface-sunken transition-colors group ${!isLast ? 'border-b border-border/60' : ''}`}
                    >
                      {/* Icon Box */}
                      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 transition-colors ${theme.iconBg} ${theme.text}`}>
                        {(() => {
                          const IconComponent = n.icon as any;
                          return <IconComponent size={20} strokeWidth={2} />;
                        })()}
                      </div>
                      
                      {/* Text */}
                      <div className="min-w-0 mt-0.5">
                        <div className="text-[13px] font-bold text-text-primary leading-tight">
                          {n.label}
                        </div>
                        <div className="text-[11.5px] text-text-secondary leading-snug mt-1 truncate">
                          {n.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Node */}
      <div className="p-4 bg-surface z-10">
        <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#f3e8ff] text-[#7e22ce] hover:bg-[#e9d5ff] transition-colors font-semibold text-[13px]">
          <Plus size={16} strokeWidth={2.5} />
          Add Custom Block
        </button>
      </div>
    </div>
  );
}
