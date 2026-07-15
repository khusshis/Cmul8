"use client";
import React from "react";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimTypeId } from "@/lib/simulation/types";
import { Play, Zap } from "lucide-react";
import type { StarterGraph } from "@/lib/simulation/simTypeRegistry";

interface NodePaletteProps {
  simType: string;
  onLoadScenario?: (graph: StarterGraph) => void;
}

export default function NodePalette({ simType, onLoadScenario }: NodePaletteProps) {
  const simConfig = SIM_TYPE_REGISTRY[simType as SimTypeId];
  const paletteNodes = simConfig?.paletteNodes ?? [];
  const scenarios = simConfig?.subScenarios?.filter((s) => s.nodes.length > 0) ?? [];

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
    <div className="p-2 space-y-4 overflow-y-auto h-full">

      {/* Scenarios Quick-Load */}
      {scenarios.length > 0 && (
        <div className="space-y-1.5">
          <div className="pt-2 pb-1 px-1">
            <span className="text-xs tracking-widest" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              SCENARIOS
            </span>
          </div>
          {scenarios.map((scenario) => (
            <button
              key={scenario.label}
              onClick={() => onLoadScenario?.(scenario)}
              className="w-full text-left p-2 rounded transition-all group"
              style={{
                background: "rgba(0,242,255,0.04)",
                border: "1px solid rgba(0,242,255,0.12)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0,242,255,0.1)";
                e.currentTarget.style.borderColor = "rgba(0,242,255,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0,242,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(0,242,255,0.12)";
              }}
            >
              <div className="flex items-center gap-1.5">
                <Play size={10} style={{ color: "var(--neon-cyan)", flexShrink: 0 }} />
                <span className="text-xs font-medium" style={{ color: "#fff", fontFamily: "var(--font-body)" }}>
                  {scenario.label}
                </span>
              </div>
              <p className="text-[10px] mt-0.5 pl-4" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", lineHeight: 1.3 }}>
                {scenario.description}
              </p>
            </button>
          ))}

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(0,242,255,0.07)", margin: "6px 0" }} />
        </div>
      )}

      {/* Node Palette Header */}
      <div className="pt-1 pb-1 px-1">
        <span className="text-xs tracking-widest" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
          NODES
        </span>
      </div>

      {/* Core Nodes */}
      <div className="space-y-1">
        <span className="text-xs px-1" style={{ fontFamily: "var(--font-mono)", color: "var(--neon-green)", opacity: 0.7 }}>
          CORE
        </span>
        {coreNodes.map((n) => (
          <div
            key={n.type}
            draggable
            onDragStart={(e) => onDragStart(e, n.type)}
            className="flex items-center gap-2 p-2 rounded cursor-grab active:cursor-grabbing transition-all"
            style={{ border: "1px solid transparent" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${n.color}10`;
              e.currentTarget.style.borderColor = `${n.color}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <span style={{ color: n.color, fontSize: "1rem" }}>{n.icon}</span>
            <div>
              <div className="text-xs font-medium text-white" style={{ fontFamily: "var(--font-body)" }}>
                {n.label}
              </div>
              <div className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "0.65rem" }}>
                {n.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Nodes */}
      {advancedNodes.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs px-1" style={{ fontFamily: "var(--font-mono)", color: "var(--neon-yellow)", opacity: 0.7 }}>
            ADVANCED
          </span>
          {advancedNodes.map((n) => (
            <div
              key={n.type}
              draggable
              onDragStart={(e) => onDragStart(e, n.type)}
              className="flex items-center gap-2 p-2 rounded cursor-grab active:cursor-grabbing transition-all"
              style={{ border: "1px solid transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${n.color}10`;
                e.currentTarget.style.borderColor = `${n.color}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <span style={{ color: n.color, fontSize: "1rem" }}>
                <Zap size={14} />
              </span>
              <div>
                <div className="text-xs font-medium text-white" style={{ fontFamily: "var(--font-body)" }}>
                  {n.label}
                </div>
                <div className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "0.65rem" }}>
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
