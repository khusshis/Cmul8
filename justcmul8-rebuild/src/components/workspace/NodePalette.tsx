"use client";

import React from "react";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimTypeId } from "@/lib/simulation/types";
import { Zap } from "lucide-react";

export interface NodePaletteProps {
  simType: string;
  onAddNode: (type: string) => void;
}

export default function NodePalette({ simType, onAddNode }: NodePaletteProps) {
  const simConfig = SIM_TYPE_REGISTRY[simType as SimTypeId] || SIM_TYPE_REGISTRY.human_queue;
  const paletteNodes = simConfig.paletteNodes || [];

  function onDragStart(e: React.DragEvent, nodeType: string) {
    e.dataTransfer.setData("application/reactflow", nodeType);
    e.dataTransfer.effectAllowed = "move";
  }

  const coreNodes = paletteNodes.filter((n) =>
    ["source", "queue", "resource", "service", "decision", "sink"].includes(n.type)
  );
  const advancedNodes = paletteNodes.filter((n) =>
    !["source", "queue", "resource", "service", "decision", "sink"].includes(n.type)
  );

  return (
    <div className="w-64 border-r border-border bg-surface h-full flex flex-col p-4 overflow-y-auto">
      <h2 className="text-sm font-semibold mb-4 text-text-primary">Node Palette</h2>

      {/* Core Nodes */}
      <div className="space-y-2 mb-6">
        <h3 className="text-xs font-mono font-medium text-text-secondary uppercase tracking-wider mb-2">Core</h3>
        {coreNodes.map((n) => (
          <div
            key={n.type}
            draggable
            onDragStart={(e) => onDragStart(e, n.type)}
            className="card-surface p-3 flex items-start gap-3 cursor-grab active:cursor-grabbing hover:border-color-info transition-colors group"
          >
            <div 
              className="mt-0.5 text-lg" 
              style={{ color: n.color }}
            >
              {n.icon}
            </div>
            <div>
              <div className="text-sm font-medium text-text-primary group-hover:text-color-info transition-colors">
                {n.label}
              </div>
              <div className="text-xs text-text-muted mt-1 leading-tight">
                {n.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Nodes */}
      {advancedNodes.length > 0 && (
        <div className="space-y-2 mb-4">
          <h3 className="text-xs font-mono font-medium text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
            <Zap size={12} /> Advanced
          </h3>
          {advancedNodes.map((n) => (
            <div
              key={n.type}
              draggable
              onDragStart={(e) => onDragStart(e, n.type)}
              className="card-surface p-3 flex items-start gap-3 cursor-grab active:cursor-grabbing hover:border-color-info transition-colors group"
            >
              <div 
                className="mt-0.5 text-lg" 
                style={{ color: n.color }}
              >
                {n.icon}
              </div>
              <div>
                <div className="text-sm font-medium text-text-primary group-hover:text-color-info transition-colors">
                  {n.label}
                </div>
                <div className="text-xs text-text-muted mt-1 leading-tight">
                  {n.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
