"use client";

import React, { useMemo, useRef, useState } from "react";
import { Copy, Crown, Layers, Palette, Save, Trash2, Upload, X } from "lucide-react";
import { applyNodeChanges, applyEdgeChanges, type Node, type Edge } from "@xyflow/react";
import TabStrip, { tabPanelProps } from "@/components/ui/TabStrip";
import NodeCanvas, { graphToSimNodes, type NodeCanvasHandle } from "@/components/workspace/NodeCanvas";
import NodePropertiesPanel from "@/components/workspace/NodePropertiesPanel";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimTypeId } from "@/lib/simulation/types";
import { describeConditions, isNeutral, type StressConditions } from "@/lib/simulation/stressTransforms";
import { diffGraphs, KEY_PARAMS, sanitizeParam, type Change } from "@/lib/simulation/scenarioDiff";
import { ConditionsEditor } from "./StressCustomize";
import { themeColor } from "@/components/ui/chartTheme";
import { Chips, HelpTip, LetterSwatch, NumberField, SCENARIO_COLORS, focusRing, inputCls } from "./shared";

export interface LabScenario {
  id: string;
  name: string;
  color: string;
  nodes: Node[];
  edges: Edge[];
  /** Canvas block ids this scenario was captured from (what "Apply to canvas" replaces). */
  sourceIds: string[];
  timestamp: string;
  stress: StressConditions;
}

type PaneView = "canvas" | "tweak" | "stress" | "changes";
type NodeData = Record<string, unknown> & { params?: Record<string, unknown>; label?: string; nodeType?: string };

const fmtVal = (v: unknown) => (v === undefined ? "not set" : typeof v === "number" ? (v === -1 ? "unlimited" : String(Number(v.toFixed(4)))) : typeof v === "object" ? "changed" : String(v));

/** One line of plain English per change. */
export function changeText(c: Change): string {
  switch (c.kind) {
    case "block-added": return `Added block "${c.label}"`;
    case "block-removed": return `Removed block "${c.label}"`;
    case "renamed": return `Renamed "${c.from}" to "${c.to}"`;
    case "param": return `${c.label}: ${c.key} ${fmtVal(c.from)} → ${fmtVal(c.to)}`;
    case "link-added": return `New link ${c.from} → ${c.to}`;
    case "link-removed": return `Removed link ${c.from} → ${c.to}`;
  }
}

export default function ScenarioPane({
  scenario,
  letter,
  baseline,
  isBaseline,
  simType,
  selectionCount,
  canEdit,
  canRemove,
  canAdd,
  disabled,
  onChange,
  onSetBaseline,
  onCapture,
  onDuplicate,
  onRemove,
  onSave,
  onApply,
}: {
  scenario: LabScenario;
  letter: string;
  baseline: LabScenario | undefined;
  isBaseline: boolean;
  simType: SimTypeId;
  selectionCount: number;
  canEdit: boolean;
  canRemove: boolean;
  canAdd: boolean;
  disabled: boolean;
  onChange: (update: (s: LabScenario) => LabScenario) => void;
  onSetBaseline: () => void;
  onCapture: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSave: () => void;
  onApply: () => void;
}) {
  const [view, setView] = useState<PaneView>("canvas");
  const canvasRef = useRef<NodeCanvasHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedNode = scenario.nodes.find((n) => n.id === selectedId);
  const paletteNodes = (SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue).paletteNodes || [];
  const sources = scenario.nodes
    .filter((n) => (n.data as NodeData)?.nodeType === "source")
    .map((n) => ({ id: n.id, label: String((n.data as NodeData)?.label ?? n.id) }));
  const stressChips = describeConditions(scenario.stress, (id) => sources.find((s) => s.id === id)?.label ?? id);
  const changes = useMemo(
    () => (baseline && !isBaseline ? diffGraphs(graphToSimNodes(baseline.nodes, baseline.edges), graphToSimNodes(scenario.nodes, scenario.edges)) : []),
    [baseline, isBaseline, scenario.nodes, scenario.edges]
  );
  const baseParams = useMemo(() => new Map((baseline?.nodes ?? []).map((n) => [n.id, ((n.data as NodeData)?.params ?? {}) as Record<string, unknown>])), [baseline]);

  function updateNode(id: string, partial: NodeData) {
    onChange((s) => ({
      ...s,
      nodes: s.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, ...partial, params: partial.params ? { ...((n.data as NodeData)?.params || {}), ...partial.params } : (n.data as NodeData)?.params } }
          : n
      ),
    }));
  }

  const tweakRows = scenario.nodes.filter((n) => KEY_PARAMS[(n.data as NodeData)?.nodeType as keyof typeof KEY_PARAMS]?.length);
  const views = [
    { id: "canvas" as const, label: "Canvas" },
    { id: "tweak" as const, label: "Tweak" },
    { id: "stress" as const, label: isNeutral(scenario.stress) ? "Stress" : "Stress •" },
    ...(!isBaseline ? [{ id: "changes" as const, label: `Changes (${changes.length + stressChips.length})` }] : []),
  ];
  const iconBtn = `flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-surface text-gray-600 hover:bg-sf-f4f2ff hover:text-fg-4331e0 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

  return (
    <section aria-label={`Scenario ${letter}: ${scenario.name}`} className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border bg-surface shadow-[0_4px_20px_-6px_rgba(87,66,255,0.10)]" style={{ borderColor: `color-mix(in oklab, ${themeColor(scenario.color)} 33%, transparent)` }}>
      <div className="h-1 w-full" style={{ background: themeColor(scenario.color) }} aria-hidden />
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-2.5 sm:px-4">
        <LetterSwatch color={scenario.color} letter={letter} size={22} />
        <input
          value={scenario.name}
          onChange={(e) => onChange((s) => ({ ...s, name: e.target.value.slice(0, 40) }))}
          onBlur={(e) => !e.target.value.trim() && onChange((s) => ({ ...s, name: `Scenario ${letter}` }))}
          aria-label={`Name of scenario ${letter}`}
          className={`${inputCls} h-8 min-w-0 flex-1 border-transparent px-1.5 font-black hover:border-gray-200`}
        />
        <details className="relative">
          <summary className={`${iconBtn} list-none [&::-webkit-details-marker]:hidden`} aria-label={`Colour of scenario ${letter}`} title="Colour">
            <Palette size={14} />
          </summary>
          <div role="radiogroup" aria-label="Scenario colour" className="absolute left-0 top-full z-40 mt-1 flex gap-1.5 rounded-xl border border-gray-100 bg-surface p-2 shadow-xl">
            {SCENARIO_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={scenario.color === c} aria-label={`Colour ${c}`} onClick={() => onChange((s) => ({ ...s, color: c }))} className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-surface ${scenario.color === c ? "ring-2 ring-gray-900" : ""} ${focusRing}`} style={{ background: themeColor(c) }} />
            ))}
          </div>
        </details>
        {isBaseline ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-0.5 dark:bg-sf-5742ff text-[10.5px] font-black uppercase tracking-wider text-white">
            <Crown size={11} aria-hidden /> Baseline
          </span>
        ) : (
          <button type="button" onClick={onSetBaseline} className={`h-8 rounded-lg border border-gray-200 px-2.5 text-[11px] font-extrabold text-gray-700 hover:bg-sf-f4f2ff ${focusRing}`} title="Compare every other scenario against this one">
            Make baseline
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onCapture} disabled={disabled} className={iconBtn} aria-label={selectionCount > 0 ? `Replace with ${selectionCount} selected blocks from the canvas` : "Replace with the full canvas"} title={selectionCount > 0 ? `Load ${selectionCount} selected` : "Load full canvas"}>
            <Layers size={14} />
          </button>
          <button type="button" onClick={onDuplicate} disabled={!canAdd || disabled} className={iconBtn} aria-label={`Duplicate scenario ${letter}`} title={canAdd ? "Duplicate" : "Up to 4 scenarios"}>
            <Copy size={14} />
          </button>
          <button type="button" onClick={onSave} className={iconBtn} aria-label={`Save scenario ${letter} to the library`} title="Save to library">
            <Save size={14} />
          </button>
          {canEdit && (
            <button type="button" onClick={onApply} disabled={disabled} className={iconBtn} aria-label={`Apply scenario ${letter} to the main canvas`} title="Apply to main canvas">
              <Upload size={14} />
            </button>
          )}
          {canRemove && (
            <button type="button" onClick={onRemove} disabled={disabled} className={`${iconBtn} hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700`} aria-label={`Remove scenario ${letter}`} title="Remove">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2.5 sm:px-4">
        <TabStrip tabs={views} value={view} onChange={setView} layoutId={`pane-${scenario.id}`} label={`Scenario ${letter} views`} />
        <span className="text-[11px] font-bold text-gray-500">{scenario.nodes.length} blocks · {scenario.edges.length} links · {scenario.timestamp}</span>
      </div>

      <div {...tabPanelProps(`pane-${scenario.id}`, view)} className={`m-3 mt-2.5 rounded-xl sm:m-4 sm:mt-2.5 ${focusRing}`}>
        {view === "canvas" && (
          <div className="relative h-[300px] overflow-hidden rounded-xl border border-gray-100 bg-sf-f9f8fd sm:h-[320px]">
            <NodeCanvas
              ref={canvasRef}
              nodes={scenario.nodes}
              edges={scenario.edges}
              simType={simType}
              simState="idle"
              hideMiniMap
              selectedNodeId={selectedId}
              onSelectNode={setSelectedId}
              onNodesChange={(c) => onChange((s) => ({ ...s, nodes: applyNodeChanges(c, s.nodes) }))}
              onEdgesChange={(c) => onChange((s) => ({ ...s, edges: applyEdgeChanges(c, s.edges) }))}
            />
            {paletteNodes.length > 0 && (
              <select
                value=""
                aria-label={`Add a block to scenario ${letter}`}
                onChange={(e) => e.target.value && canvasRef.current?.addNode(e.target.value)}
                className={`${inputCls} absolute left-2 top-2 z-20 h-8 text-[11.5px] shadow-sm`}
              >
                <option value="">+ Add block</option>
                {paletteNodes.map((n) => <option key={n.type} value={n.type}>{n.label}</option>)}
              </select>
            )}
            {selectedNode && (
              <div className="absolute right-0 top-0 z-30 flex h-full w-[300px] max-w-[85%] flex-col border-l border-indigo-100 bg-sf-faf9ff shadow-[-8px_0_24px_rgba(0,0,0,0.06)]">
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Close block settings" className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-surface text-gray-500 hover:bg-gray-100 ${focusRing}`}>
                  <X size={13} />
                </button>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <NodePropertiesPanel node={selectedNode} nodes={scenario.nodes} edges={scenario.edges} simType={simType} onUpdate={updateNode} />
                </div>
              </div>
            )}
          </div>
        )}

        {view === "tweak" && (
          <div className="max-h-[400px] overflow-auto rounded-xl border border-gray-100">
            {tweakRows.length === 0 ? (
              <p className="p-6 text-center text-[12.5px] text-gray-500">No blocks with adjustable numbers here.</p>
            ) : (
              <table className="w-full min-w-[360px] text-left text-[12px]">
                <caption className="sr-only">Key numbers per block{isBaseline ? "" : "; highlighted cells differ from the baseline"}</caption>
                <tbody className="divide-y divide-gray-50">
                  {tweakRows.map((n) => {
                    const d = n.data as NodeData;
                    const specs = KEY_PARAMS[d.nodeType as keyof typeof KEY_PARAMS]!;
                    const params = (d.params ?? {}) as Record<string, unknown>;
                    const base = baseParams.get(n.id);
                    return (
                      <tr key={n.id} className="align-top">
                        <th scope="row" className="w-[34%] px-3 py-2.5 font-bold text-gray-800">
                          <span className="block truncate" title={String(d.label ?? n.id)}>{String(d.label ?? n.id)}</span>
                          {!isBaseline && !base && <span className="text-[10.5px] font-semibold text-emerald-700">new block</span>}
                        </th>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {specs.map((spec) => {
                              const v = typeof params[spec.key] === "number" ? (params[spec.key] as number) : spec.fallback;
                              const bv = base ? (typeof base[spec.key] === "number" ? (base[spec.key] as number) : spec.fallback) : undefined;
                              const changed = !isBaseline && bv !== undefined && bv !== v;
                              return (
                                <div key={spec.key} className={`rounded-lg px-1.5 py-1 ${changed ? "bg-amber-50 ring-1 ring-amber-300" : ""}`}>
                                  <div className="mb-0.5 flex items-center gap-0.5 text-[10.5px] font-bold text-gray-500">
                                    {spec.label}
                                    <HelpTip text={spec.help} label={`About ${spec.label}`} align="start" />
                                  </div>
                                  <NumberField
                                    label={`${String(d.label ?? n.id)} ${spec.label}`}
                                    value={v}
                                    step={spec.integer ? 1 : 0.1}
                                    width="w-20"
                                    disabled={disabled}
                                    onCommit={(raw) => {
                                      const clean = sanitizeParam(spec, raw);
                                      if (clean !== null) updateNode(n.id, { params: { [spec.key]: clean } });
                                    }}
                                  />
                                  {changed && <p className="mt-0.5 text-[10px] font-semibold text-amber-800">was {fmtVal(bv)}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {view === "stress" && (
          <div className="rounded-xl border border-gray-100 p-4">
            <p className="mb-3 text-[12px] text-gray-600">Run this scenario under pressure without editing it. Applied to a copy on every run.</p>
            <ConditionsEditor value={scenario.stress} onChange={(stress) => onChange((s) => ({ ...s, stress }))} sources={sources} disabled={disabled} compact />
          </div>
        )}

        {view === "changes" && (
          <div className="max-h-[400px] overflow-auto rounded-xl border border-gray-100 p-4">
            {changes.length === 0 && stressChips.length === 0 ? (
              <p className="text-[12.5px] text-gray-500">Identical to the baseline{baseline ? ` (${baseline.name})` : ""}. Tweak a number or edit the canvas to create a variant.</p>
            ) : (
              <>
                {stressChips.length > 0 && <div className="mb-3"><Chips items={stressChips} /></div>}
                <ul className="space-y-1.5 text-[12.5px]">
                  {changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${c.kind.endsWith("removed") ? "bg-rose-500" : c.kind.endsWith("added") ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
                      <span className="text-gray-700">{changeText(c)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
