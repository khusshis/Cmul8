"use client";

import React, { useState } from "react";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimTypeId } from "@/lib/simulation/types";
import { X, ChevronUp, ChevronDown, Plus, Search } from "lucide-react";

export interface NodePaletteProps {
  simType: string;
  onAddNode: (type: string) => void;
}

const CATEGORY_STYLES: Record<string, { label: string; iconBg: string; iconColor: string; dotColor: string }> = {
  CORE:      { label: "text-indigo-600", iconBg: "bg-indigo-50",  iconColor: "text-indigo-600",  dotColor: "bg-indigo-400" },
  RESOURCES: { label: "text-emerald-600", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", dotColor: "bg-emerald-400" },
  ROUTING:   { label: "text-orange-500",  iconBg: "bg-orange-50",  iconColor: "text-orange-500",  dotColor: "bg-orange-400" },
  ADVANCED:  { label: "text-violet-600", iconBg: "bg-violet-50",  iconColor: "text-violet-600",  dotColor: "bg-violet-400" },
};

export default function NodePalette({ simType, onAddNode }: NodePaletteProps) {
  const simConfig = SIM_TYPE_REGISTRY[simType as SimTypeId] || SIM_TYPE_REGISTRY.human_queue;
  const paletteNodes = simConfig.paletteNodes || [];
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function onDragStart(e: React.DragEvent, nodeType: string) {
    e.dataTransfer.setData("application/reactflow", nodeType);
    e.dataTransfer.effectAllowed = "move";
  }

  const categories = [
    { id: "CORE",      nodes: paletteNodes.filter((n) => ["source", "queue", "service", "sink"].includes(n.type)) },
    { id: "RESOURCES", nodes: paletteNodes.filter((n) => ["resource", "priority_resource"].includes(n.type)) },
    { id: "ROUTING",   nodes: paletteNodes.filter((n) => ["decision", "channel", "broadcaster"].includes(n.type)) },
    {
      id: "ADVANCED",
      nodes: paletteNodes.filter(
        (n) => !["source","queue","service","sink","resource","priority_resource","decision","channel","broadcaster"].includes(n.type)
      ),
    },
  ];

  const q = search.toLowerCase().trim();

  return (
    <div className="w-[280px] border-r border-gray-100 bg-white h-full flex flex-col overflow-hidden shadow-[2px_0_12px_rgba(0,0,0,0.03)]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Plus size={13} strokeWidth={2.5} />
          </div>
          <h2 className="text-[14px] font-bold text-[#111827] tracking-tight">Block Palette</h2>
        </div>
        <button className="p-1 hover:bg-gray-50 rounded-lg text-gray-400 transition-colors">
          <X size={15} strokeWidth={2.5} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks..."
            className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-gray-100 text-[12px] bg-[#fcfcfd] outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-50 transition-all text-[#111827] placeholder:text-gray-400 font-medium"
          />
        </div>
      </div>

      {/* Scrollable Node List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-3 space-y-4">
        {categories.map((cat) => {
          const filtered = q
            ? cat.nodes.filter((n) => n.label.toLowerCase().includes(q) || (n as any).desc?.toLowerCase().includes(q))
            : cat.nodes;
          if (filtered.length === 0) return null;

          const theme = CATEGORY_STYLES[cat.id] || CATEGORY_STYLES.CORE;
          const isCollapsed = collapsed[cat.id];

          return (
            <div key={cat.id}>
              {/* Category header */}
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [cat.id]: !p[cat.id] }))}
                className="w-full flex items-center justify-between px-1 mb-2 group"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.dotColor}`} />
                  <h3 className={`text-[10.5px] font-bold tracking-[0.12em] uppercase ${theme.label}`}>
                    {cat.id}
                  </h3>
                </div>
                {isCollapsed
                  ? <ChevronDown size={13} className={`${theme.label} opacity-70`} />
                  : <ChevronUp size={13} className={`${theme.label} opacity-70`} />
                }
              </button>

              {!isCollapsed && (
                <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                  {filtered.map((n, idx) => {
                    const isLast = idx === filtered.length - 1;
                    return (
                      <div
                        key={n.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, n.type)}
                        onClick={() => onAddNode(n.type)}
                        className={`p-3.5 flex items-center gap-3 cursor-grab active:cursor-grabbing hover:bg-[#fcfcfd] transition-colors group ${!isLast ? "border-b border-gray-100" : ""}`}
                      >
                        {/* Icon Box */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${theme.iconBg} ${theme.iconColor} group-hover:scale-105 transition-transform duration-200`}>
                          {(() => {
                            const IconComponent = n.icon as any;
                            return <IconComponent size={17} strokeWidth={2} />;
                          })()}
                        </div>

                        {/* Text */}
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-bold text-[#111827] leading-tight">{n.label}</div>
                          {(n as any).desc && (
                            <div className="text-[11px] text-[#64748b] leading-snug mt-0.5 line-clamp-1">{(n as any).desc}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 bg-white">
        <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors font-bold text-[12.5px] border border-indigo-100/60">
          <Plus size={14} strokeWidth={2.5} />
          Add Custom Block
        </button>
      </div>
    </div>
  );
}
