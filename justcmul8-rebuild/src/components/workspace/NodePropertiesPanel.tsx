"use client";

import React from "react";
import type { Node } from "@xyflow/react";
import { Settings, Type, Clock, Users, Route, Plus, Trash2, Activity, Zap, Server, ShieldAlert, Target } from "lucide-react";

interface NodePropertiesPanelProps {
  node: Node;
  simType: string;
  onUpdate: (id: string, partialData: any) => void;
}

// ─── Common Styles ─────────────────────────────────────────────
const inputCls = "input-surface w-full mt-1";
const selectCls = "input-surface w-full mt-1";
const labelCls = "block text-sm font-medium text-text-secondary";
const sectionCls = "space-y-4 pt-4 border-t border-border";
const sectionHeadingCls = "text-xs font-bold tracking-widest mb-2 flex items-center gap-1.5 text-text-primary uppercase";

function SectionHeading({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className={sectionHeadingCls}>
      <Icon size={14} className="text-text-secondary" />
      {children}
    </div>
  );
}

// ─── Glossary Mappings ──────────────────────────────────────────
const DISTRIBUTIONS = [
  { value: "exponential", label: "Random (typical spacing)" },
  { value: "normal", label: "Random (around an average)" },
  { value: "uniform", label: "Random (equally likely range)" },
  { value: "deterministic", label: "Fixed (always the same)" },
  { value: "poisson", label: "Poisson" }
];

const DISCIPLINES = [
  { value: "FIFO", label: "Serve in arrival order (first come, first served)" },
  { value: "LIFO", label: "Serve most recent first" },
  { value: "PRIORITY", label: "Serve most urgent first" }
];

const DistSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <select value={value || "exponential"} onChange={(e) => onChange(e.target.value)} className={selectCls}>
    {DISTRIBUTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
  </select>
);

// ─── 1. Source (Arrival Point) ──────────────────────────────────
function SourceProperties({ params, nodeId, onUpdate }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }

  const schedule: { simTime: number; count: number }[] = params.schedule || [];
  const useSchedule = schedule.length > 0;

  return (
    <>
      <div className={sectionCls}>
        <SectionHeading icon={Clock}>Arrival Timing</SectionHeading>
        
        <div className="flex items-center justify-between">
          <label className={labelCls}>Infinite Arrivals</label>
          <button
            onClick={() => setParam("infiniteArrivals", !params.infiniteArrivals)}
            className={`px-3 py-1 text-xs font-mono rounded ${params.infiniteArrivals ? "bg-accent text-white" : "bg-surface border border-border text-text-secondary"}`}
          >
            {params.infiniteArrivals ? "ON" : "OFF"}
          </button>
        </div>

        {!params.infiniteArrivals && (
          <div>
            <label className={labelCls}>Max Entities (cap)</label>
            <input type="number" min={1} value={params.maxEntities || ""} onChange={(e) => setParam("maxEntities", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="Unlimited" className={inputCls} />
          </div>
        )}

        <div className="flex rounded border border-border overflow-hidden mt-3">
          {["Rate-Based", "Schedule"].map((mode) => {
            const active = mode === "Schedule" ? useSchedule : !useSchedule;
            return (
              <button
                key={mode}
                onClick={() => {
                  if (mode === "Schedule" && !useSchedule) setParam("schedule", [{ simTime: 0, count: 1 }]);
                  if (mode === "Rate-Based" && useSchedule) setParam("schedule", []);
                }}
                className={`flex-1 py-1.5 text-xs font-bold transition-all ${active ? "bg-accent/10 text-accent" : "text-text-secondary"}`}
              >
                {mode}
              </button>
            );
          })}
        </div>

        {!useSchedule ? (
          <>
            <div>
              <label className={labelCls}>Arrival Spacing</label>
              <DistSelect value={params.distribution} onChange={(v) => setParam("distribution", v)} />
            </div>
            <div>
              <label className={labelCls}>Arrival Rate (entities / time unit)</label>
              <input type="number" min={0.0001} step={0.1} value={params.arrivalRate ?? 1} onChange={(e) => setParam("arrivalRate", Number(e.target.value))} className={inputCls} />
            </div>
          </>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className={labelCls}>Schedule Entries</label>
              <button onClick={() => setParam("schedule", [...schedule, { simTime: 0, count: 1 }])} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus size={12}/> ADD</button>
            </div>
            {schedule.map((entry, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input type="number" min={0} value={entry.simTime} onChange={(e) => {
                  const s = [...schedule]; s[idx].simTime = Number(e.target.value); setParam("schedule", s);
                }} placeholder="Time" className={inputCls} />
                <input type="number" min={1} value={entry.count} onChange={(e) => {
                  const s = [...schedule]; s[idx].count = Number(e.target.value); setParam("schedule", s);
                }} placeholder="Count" className={inputCls} />
                <button onClick={() => setParam("schedule", schedule.filter((_, i) => i !== idx))} className="text-error mt-1"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={sectionCls}>
        <SectionHeading icon={Users}>Entity Attributes</SectionHeading>
        <div>
          <label className={labelCls}>Entity Class / Type</label>
          <input type="text" value={params.entityClass || "standard"} onChange={(e) => setParam("entityClass", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Priority Level</label>
          <select value={params.priorityLevel || "standard"} onChange={(e) => setParam("priorityLevel", e.target.value)} className={selectCls}>
            <option value="standard">Standard</option>
            <option value="priority">Priority</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
    </>
  );
}

// ─── 2. Queue (Waiting Line) ────────────────────────────────────
function QueueProperties({ params, nodeId, onUpdate }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Clock}>Line Settings</SectionHeading>
      
      <div>
        <label className={labelCls}>Capacity (-1 for infinite)</label>
        <input type="number" value={params.capacity ?? -1} onChange={(e) => setParam("capacity", Number(e.target.value))} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Service Order</label>
        <select value={params.discipline || "FIFO"} onChange={(e) => setParam("discipline", e.target.value)} className={selectCls}>
          {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>

      <div className="pt-4 border-t border-border mt-4">
        <label className={labelCls}>Patience (Renege) Model</label>
        <DistSelect value={params.patienceDistribution || "none"} onChange={(v) => {
          if (v === "none") {
            const p = { ...params }; delete p.patienceDistribution; onUpdate(nodeId, { params: p });
          } else {
            setParam("patienceDistribution", v);
          }
        }} />
      </div>
      
      {params.patienceDistribution && params.patienceDistribution !== "none" && (
        <div className="mt-2">
          <label className={labelCls}>Patience Timeout (Mean)</label>
          <input type="number" value={params.patienceTimeout ?? 5} onChange={(e) => setParam("patienceTimeout", Number(e.target.value))} className={inputCls} />
        </div>
      )}
    </div>
  );
}

// ─── 3 & 10. Resource / Priority Resource (Staff/Machine) ───────
function ResourceProperties({ params, nodeId, onUpdate, isPriorityNode }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Server}>Worker / Machine Settings</SectionHeading>
      
      <div>
        <label className={labelCls}>Capacity (Parallel servers)</label>
        <input type="number" min={1} value={params.capacity ?? 1} onChange={(e) => setParam("capacity", Number(e.target.value))} className={inputCls} />
      </div>
      
      <div>
        <label className={labelCls}>Service Time (Mean)</label>
        <input type="number" min={0} value={params.serviceTimeMean ?? 1} onChange={(e) => setParam("serviceTimeMean", Number(e.target.value))} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Service Time Randomness</label>
        <DistSelect value={params.serviceDistribution} onChange={(v) => setParam("serviceDistribution", v)} />
      </div>

      <div className="flex items-center justify-between mt-4">
        <label className={labelCls}>Can interrupt lower-priority work</label>
        <button onClick={() => setParam("isPreemptive", !params.isPreemptive)} className={`px-3 py-1 text-xs font-mono rounded ${params.isPreemptive ? "bg-accent text-white" : "bg-surface border border-border text-text-secondary"}`}>
          {params.isPreemptive ? "YES" : "NO"}
        </button>
      </div>

      <div className="pt-4 border-t border-border mt-4">
        <label className={labelCls}>How often does this break down, on average?</label>
        <input type="number" min={0} value={params.meanTimeBetweenFailures ?? ""} placeholder="Never" onChange={(e) => setParam("meanTimeBetweenFailures", e.target.value ? Number(e.target.value) : undefined)} className={inputCls} />
      </div>
      
      {params.meanTimeBetweenFailures > 0 && (
        <div className="mt-2">
          <label className={labelCls}>Average Repair Time</label>
          <input type="number" min={0} value={params.repairTimeMean ?? 1} onChange={(e) => setParam("repairTimeMean", Number(e.target.value))} className={inputCls} />
        </div>
      )}
    </div>
  );
}

// ─── 4. Service (Processing Step) ───────────────────────────────
function ServiceProperties({ params, nodeId, onUpdate }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Activity}>Processing Settings</SectionHeading>
      <div>
        <label className={labelCls}>Service Time (Mean)</label>
        <input type="number" min={0} value={params.durationMean ?? 1} onChange={(e) => setParam("durationMean", Number(e.target.value))} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Service Time Randomness</label>
        <DistSelect value={params.distribution} onChange={(v) => setParam("distribution", v)} />
      </div>
    </div>
  );
}

// ─── 5. Decision (Split Path) ───────────────────────────────────
function DecisionProperties({ params, nodeId, onUpdate }: any) {
  const routes: { targetId: string; probability: number }[] = params.routes || [];
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Route}>Routing Probabilities</SectionHeading>
      <div className="flex justify-between items-center mb-2">
        <label className={labelCls}>Branches</label>
        <button onClick={() => onUpdate(nodeId, { params: { ...params, routes: [...routes, { targetId: "", probability: 0.5 }] } })} className="text-xs text-accent hover:underline flex items-center gap-1"><Plus size={12}/> ADD</button>
      </div>
      {routes.map((route, idx) => (
        <div key={idx} className="flex gap-2 mb-2">
          <input type="text" value={route.targetId} onChange={(e) => {
            const r = [...routes]; r[idx].targetId = e.target.value; onUpdate(nodeId, { params: { ...params, routes: r } });
          }} placeholder="Target Node ID" className={inputCls} />
          <input type="number" min={0} max={1} step={0.1} value={route.probability} onChange={(e) => {
            const r = [...routes]; r[idx].probability = Number(e.target.value); onUpdate(nodeId, { params: { ...params, routes: r } });
          }} placeholder="Probability" className={inputCls} />
          <button onClick={() => {
            onUpdate(nodeId, { params: { ...params, routes: routes.filter((_, i) => i !== idx) } });
          }} className="text-error mt-1"><Trash2 size={16} /></button>
        </div>
      ))}
      {routes.length === 0 && <p className="text-xs text-text-secondary">No routes defined. Add branches manually or connect edges.</p>}
    </div>
  );
}

// ─── 6. Sink (Exit Point) ───────────────────────────────────────
function SinkProperties({ params, nodeId, onUpdate }: any) {
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Target}>Exit Settings</SectionHeading>
      <div className="flex items-center justify-between">
        <label className={labelCls}>Collect KPIs</label>
        <button onClick={() => onUpdate(nodeId, { params: { ...params, collectKPIs: !params.collectKPIs } })} className={`px-3 py-1 text-xs font-mono rounded ${params.collectKPIs ? "bg-accent text-white" : "bg-surface border border-border text-text-secondary"}`}>
          {params.collectKPIs ? "YES" : "NO"}
        </button>
      </div>
    </div>
  );
}

// ─── 7. Container (Tank/Reservoir) ──────────────────────────────
function ContainerProperties({ params, nodeId, onUpdate }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Activity}>Tank Settings</SectionHeading>
      <div>
        <label className={labelCls}>Capacity</label>
        <input type="number" min={1} value={params.capacity ?? 100} onChange={(e) => setParam("capacity", Number(e.target.value))} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Initial Level</label>
        <input type="number" min={0} value={params.initialLevel ?? 0} onChange={(e) => setParam("initialLevel", Number(e.target.value))} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Fill/Drain Rate (per unit time)</label>
        <input type="number" value={params.fillRate ?? 1} onChange={(e) => setParam("fillRate", Number(e.target.value))} className={inputCls} />
      </div>
    </div>
  );
}

// ─── 8. Store (Storage Buffer) ──────────────────────────────────
function StoreProperties({ params, nodeId, onUpdate }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Server}>Storage Settings</SectionHeading>
      <div>
        <label className={labelCls}>Capacity (-1 for infinite)</label>
        <input type="number" value={params.capacity ?? -1} onChange={(e) => setParam("capacity", Number(e.target.value))} className={inputCls} />
      </div>
      <div className="flex items-center justify-between mt-3">
        <label className={labelCls}>Retrieve Highest Priority First</label>
        <button onClick={() => setParam("isPriority", !params.isPriority)} className={`px-3 py-1 text-xs font-mono rounded ${params.isPriority ? "bg-accent text-white" : "bg-surface border border-border text-text-secondary"}`}>
          {params.isPriority ? "ON" : "OFF"}
        </button>
      </div>
      <div className="pt-4 border-t border-border mt-4">
        <label className={labelCls}>Filter Output By Property</label>
        <select value={params.filterOperator || "=="} onChange={(e) => setParam("filterOperator", e.target.value)} className={selectCls}>
          <option value="==">Equals</option>
          <option value="!=">Not Equals</option>
          <option value=">">Greater Than</option>
          <option value="<">Less Than</option>
        </select>
        <input type="text" placeholder="Property (e.g., entityClass)" value={params.filterProperty || ""} onChange={(e) => setParam("filterProperty", e.target.value)} className={inputCls} />
        <input type="text" placeholder="Value (e.g., vip)" value={params.filterValue || ""} onChange={(e) => setParam("filterValue", e.target.value)} className={inputCls} />
      </div>
    </div>
  );
}

// ─── 9. Event Trigger (Condition Watcher) ───────────────────────
function EventTriggerProperties({ params, nodeId, onUpdate }: any) {
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Zap}>Watcher Settings</SectionHeading>
      <div>
        <label className={labelCls}>Event Name to Broadcast</label>
        <input type="text" value={params.eventName || ""} onChange={(e) => onUpdate(nodeId, { params: { ...params, eventName: e.target.value } })} placeholder="e.g. System_Ready" className={inputCls} />
      </div>
    </div>
  );
}

// ─── 11. Channel (Transmission Link) ────────────────────────────
function ChannelProperties({ params, nodeId, onUpdate }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Route}>Link Settings</SectionHeading>
      <div>
        <label className={labelCls}>Propagation Delay (Time)</label>
        <input type="number" min={0} value={params.propagationDelay ?? 1} onChange={(e) => setParam("propagationDelay", Number(e.target.value))} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Delay Randomness</label>
        <DistSelect value={params.delayDistribution} onChange={(v) => setParam("delayDistribution", v)} />
      </div>
      <div>
        <label className={labelCls}>Buffer Capacity</label>
        <input type="number" min={-1} value={params.bufferCapacity ?? -1} onChange={(e) => setParam("bufferCapacity", Number(e.target.value))} className={inputCls} />
      </div>
    </div>
  );
}

// ─── 12. Broadcaster (Broadcast Hub) ────────────────────────────
function BroadcasterProperties({ params, nodeId, onUpdate }: any) {
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Activity}>Hub Settings</SectionHeading>
      <div>
        <label className={labelCls}>Buffer Capacity (per connection)</label>
        <input type="number" min={-1} value={params.bufferCapacity ?? -1} onChange={(e) => onUpdate(nodeId, { params: { ...params, bufferCapacity: Number(e.target.value) } })} className={inputCls} />
      </div>
    </div>
  );
}

// ─── 13 & 14. Wait For Any / Wait For All ───────────────────────
function WaitNodeProperties({ params, nodeId, onUpdate, title }: any) {
  return (
    <div className={sectionCls}>
      <SectionHeading icon={ShieldAlert}>{title} Settings</SectionHeading>
      <div>
        <label className={labelCls}>Target Node ID to Trigger</label>
        <input type="text" value={params.targetId || ""} onChange={(e) => onUpdate(nodeId, { params: { ...params, targetId: e.target.value } })} placeholder="Next Step ID" className={inputCls} />
      </div>
    </div>
  );
}

// ─── 15. Interrupter (Interrupt Signal) ─────────────────────────
function InterrupterProperties({ params, nodeId, onUpdate }: any) {
  return (
    <div className={sectionCls}>
      <SectionHeading icon={ShieldAlert}>Interrupt Settings</SectionHeading>
      <div>
        <label className={labelCls}>Target Node ID to Interrupt</label>
        <input type="text" value={params.targetNodeId || ""} onChange={(e) => onUpdate(nodeId, { params: { ...params, targetNodeId: e.target.value } })} placeholder="e.g. Worker_1" className={inputCls} />
      </div>
      <div className="mt-3">
        <label className={labelCls}>Cause Message</label>
        <input type="text" value={params.cause || ""} onChange={(e) => onUpdate(nodeId, { params: { ...params, cause: e.target.value } })} placeholder="e.g. Machine Failed" className={inputCls} />
      </div>
    </div>
  );
}

// ─── Main Panel Container ───────────────────────────────────────
export default function NodePropertiesPanel({ node, simType, onUpdate }: NodePropertiesPanelProps) {
  if (!node) return null;

  const data = node.data || {};
  const { nodeType, label, params } = data as any;

  return (
    <div className="h-full flex flex-col bg-surface text-text-primary">
      {/* Header */}
      <div className="p-4 flex items-center gap-2 border-b border-border">
        <Settings size={16} className="text-text-secondary" />
        <span className="text-xs tracking-widest font-bold uppercase text-text-primary">
          NODE PROPERTIES
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Core Identifiers */}
        <div className="space-y-4">
          <div>
            <label className={labelCls + " flex items-center gap-1"}><Type size={14} /> Label / Name</label>
            <input
              type="text"
              value={label || ""}
              onChange={(e) => onUpdate(node.id, { label: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Node Type</label>
            <div className="text-sm px-3 py-2 bg-surface border border-border rounded mt-1 capitalize text-text-secondary">
              {nodeType?.replace(/_/g, " ")}
            </div>
          </div>
        </div>

        {/* Dynamic Type-Specific Forms */}
        {nodeType === "source" && <SourceProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "queue" && <QueueProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "resource" && <ResourceProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} isPriorityNode={false} />}
        {nodeType === "priority_resource" && <ResourceProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} isPriorityNode={true} />}
        {nodeType === "service" && <ServiceProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "decision" && <DecisionProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "sink" && <SinkProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "container" && <ContainerProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "store" && <StoreProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "event_trigger" && <EventTriggerProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "channel" && <ChannelProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "broadcaster" && <BroadcasterProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
        {nodeType === "any_of" && <WaitNodeProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} title="Wait For Any" />}
        {nodeType === "all_of" && <WaitNodeProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} title="Wait For All" />}
        {nodeType === "interrupter" && <InterrupterProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}
