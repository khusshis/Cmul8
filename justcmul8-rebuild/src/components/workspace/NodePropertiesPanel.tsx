"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Node } from "@xyflow/react";
import {
  Settings,
  Type,
  Clock,
  Users,
  Route,
  Plus,
  Trash2,
  Activity,
  Zap,
  Server,
  ShieldAlert,
  Target,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  Share2,
  ChevronDown,
  Check,
  HelpCircle,
} from "lucide-react";
import Switch from "@/components/ui/Switch";
import { NODE_BASE_COLORS } from "@/components/workspace/NodeCanvas";

interface NodePropertiesPanelProps {
  node: Node;
  simType: string;
  onUpdate: (id: string, partialData: any) => void;
}

// ─── Theme Mapping for Node Categories ─────────────────────────
const NODE_THEMES: Record<
  string,
  {
    category: string;
    label: string;
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeText: string;
    accent: string;
    icon: any;
  }
> = {
  source: {
    category: "CORE",
    label: "Entrance / Arrival Source",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700 border-indigo-200",
    accent: "#6366F1",
    icon: Play,
  },
  queue: {
    category: "CORE",
    label: "Waiting Line (Queue)",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    badgeBg: "bg-violet-50",
    badgeText: "text-violet-700 border-violet-200",
    accent: "#8B5CF6",
    icon: Clock,
  },
  service: {
    category: "CORE",
    label: "Processing Step (Service)",
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
    badgeBg: "bg-cyan-50",
    badgeText: "text-cyan-700 border-cyan-200",
    accent: "#06B6D4",
    icon: Activity,
  },
  sink: {
    category: "CORE",
    label: "Exit (Sink)",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-700",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-700 border-slate-200",
    accent: "#64748B",
    icon: Target,
  },
  resource: {
    category: "RESOURCES",
    label: "Staff Member / Server",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700 border-emerald-200",
    accent: "#10B981",
    icon: Server,
  },
  priority_resource: {
    category: "RESOURCES",
    label: "Fast-Track Priority Server",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
    badgeBg: "bg-teal-50",
    badgeText: "text-teal-700 border-teal-200",
    accent: "#0D9488",
    icon: ShieldAlert,
  },
  decision: {
    category: "ROUTING",
    label: "Split Router (Decision)",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700 border-amber-200",
    accent: "#F59E0B",
    icon: Route,
  },
  channel: {
    category: "ROUTING",
    label: "Transfer Link (Channel)",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    badgeBg: "bg-orange-50",
    badgeText: "text-orange-700 border-orange-200",
    accent: "#EA580C",
    icon: Share2,
  },
  broadcaster: {
    category: "ROUTING",
    label: "Broadcast Hub",
    iconBg: "bg-red-50",
    iconColor: "text-red-600",
    badgeBg: "bg-red-50",
    badgeText: "text-red-700 border-red-200",
    accent: "#EF4444",
    icon: Zap,
  },
  store: {
    category: "ADVANCED",
    label: "Storage Buffer (Store)",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700 border-purple-200",
    accent: "#9333EA",
    icon: Layers,
  },
  container: {
    category: "ADVANCED",
    label: "Fluid / Level Tank",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700 border-blue-200",
    accent: "#2563EB",
    icon: Activity,
  },
  event_trigger: {
    category: "ADVANCED",
    label: "Event Watcher",
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
    badgeBg: "bg-pink-50",
    badgeText: "text-pink-700 border-pink-200",
    accent: "#DB2777",
    icon: Zap,
  },
};

// ─── Custom Themed Dropdown Component ──────────────────────────
interface DropdownOption {
  value: string;
  label: string;
  desc?: string;
  emoji?: string;
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
}: {
  value: string;
  onChange: (val: string) => void;
  options: DropdownOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as unknown as globalThis.Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 230);
    }
    setOpen((o) => !o);
  };

  return (
    <div className="relative mt-1.5 w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all bg-[#FAFAFC] hover:bg-white ${
          open
            ? "border-[#5742FF] ring-2 ring-[#5742FF]/15 shadow-sm"
            : "border-gray-200/80 hover:border-gray-300"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedOption?.emoji && <span className="text-[14px]">{selectedOption.emoji}</span>}
          <div className="min-w-0 truncate">
            <span className="text-[12.5px] font-bold text-gray-900 block truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
        </div>
        <ChevronDown
          size={15}
          className={`text-gray-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-[#5742FF]" : ""
          }`}
        />
      </button>

      {/* Floating Menu Popover (Opens Upward or Downward depending on screen space) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: openUpwards ? -6 : 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpwards ? -4 : 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute left-0 right-0 ${
              openUpwards ? "bottom-full mb-1.5" : "top-full mt-1.5"
            } z-50 rounded-2xl bg-white border border-gray-100 shadow-[0_16px_40px_rgba(0,0,0,0.14)] p-1.5 max-h-56 overflow-y-auto custom-scrollbar`}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? "bg-indigo-50/90 text-[#5742FF] font-bold"
                      : "hover:bg-gray-50 text-gray-800"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {opt.emoji && <span className="text-[15px] shrink-0 mt-0.5">{opt.emoji}</span>}
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold leading-tight truncate">
                        {opt.label}
                      </div>
                      {opt.desc && (
                        <div className="text-[11px] text-gray-400 font-medium leading-snug mt-0.5">
                          {opt.desc}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[#5742FF] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Input & Section Card Styles ───────────────────────────────
const modernInputCls =
  "w-full mt-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200/80 bg-[#FAFAFC] focus:bg-white text-[12.5px] font-semibold text-[#111827] focus:border-[#5742FF] focus:ring-2 focus:ring-[#5742FF]/10 transition-all outline-none";
const labelCls = "block text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]";
const sectionCls =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] p-4 space-y-3.5";

function SectionHeading({
  icon: Icon,
  children,
  accent = "#6366F1",
  iconBg = "bg-indigo-50",
  iconColor = "text-indigo-600",
}: {
  icon: any;
  children: React.ReactNode;
  accent?: string;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold ${iconBg} ${iconColor}`}>
        <Icon size={13} strokeWidth={2.3} />
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: accent }}>
        {children}
      </span>
    </div>
  );
}

// ─── Non-Technical Plain-English Options ────────────────────────
const ARRIVAL_DISTRIBUTIONS: DropdownOption[] = [
  {
    value: "exponential",
    emoji: "🎲",
    label: "Natural Random Spacing",
    desc: "Typical real-world flow (arrivals happen at random intervals)",
  },
  {
    value: "normal",
    emoji: "📊",
    label: "Clustered Around an Average",
    desc: "Most arrivals happen around the target time (bell curve)",
  },
  {
    value: "uniform",
    emoji: "↔️",
    label: "Even Range Spread",
    desc: "Arrivals are equally likely anywhere between min and max time",
  },
  {
    value: "deterministic",
    emoji: "⏱️",
    label: "Fixed & Exact Spacing",
    desc: "Arrivals show up at the exact same interval (like a clock)",
  },
  {
    value: "poisson",
    emoji: "⚡",
    label: "Rush Hour / Burst Spikes",
    desc: "Sudden bunches of people arriving in bursts",
  },
];

const SERVICE_DISTRIBUTIONS: DropdownOption[] = [
  {
    value: "exponential",
    emoji: "🎲",
    label: "Random Service Duration",
    desc: "Some tasks are quick, some take longer (standard)",
  },
  {
    value: "normal",
    emoji: "📊",
    label: "Consistent Around Average",
    desc: "Most tasks take roughly the same average time",
  },
  {
    value: "uniform",
    emoji: "↔️",
    label: "Anywhere in Time Range",
    desc: "Takes an even random amount between min and max seconds",
  },
  {
    value: "deterministic",
    emoji: "⏱️",
    label: "Fixed Constant Duration",
    desc: "Always takes the exact same number of seconds",
  },
];

const QUEUE_DISCIPLINES: DropdownOption[] = [
  {
    value: "FIFO",
    emoji: "🚶",
    label: "First Come, First Served",
    desc: "Whoever enters line first gets served first (Standard)",
  },
  {
    value: "LIFO",
    emoji: "📦",
    label: "Most Recent First (Stack)",
    desc: "Last item placed on top gets taken first",
  },
  {
    value: "PRIORITY",
    emoji: "⭐",
    label: "VIP & Urgent First",
    desc: "Higher priority items skip to the front of the line",
  },
];

const PATIENCE_MODELS: DropdownOption[] = [
  {
    value: "none",
    emoji: "♾️",
    label: "Never Give Up (Infinite Patience)",
    desc: "People stay in line no matter how long it takes",
  },
  {
    value: "exponential",
    emoji: "⏳",
    label: "Random Patience Limits",
    desc: "Some leave line early, others are willing to wait longer",
  },
  {
    value: "deterministic",
    emoji: "⏱️",
    label: "Exact Maximum Wait Limit",
    desc: "People leave if the line wait exceeds a set number of seconds",
  },
];

const PRIORITY_TIERS: DropdownOption[] = [
  {
    value: "standard",
    emoji: "👤",
    label: "Standard Priority (Regular)",
    desc: "Normal customer or item",
  },
  {
    value: "priority",
    emoji: "⚡",
    label: "Fast-Track Priority",
    desc: "Gets served before standard items",
  },
  {
    value: "urgent",
    emoji: "🚨",
    label: "VIP / Emergency Urgent",
    desc: "Highest possible priority in the entire flow",
  },
];

// ─── 1. Source (Arrival Point) ──────────────────────────────────
function SourceProperties({ params, nodeId, onUpdate, theme }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }

  const schedule: { simTime: number; count: number }[] = params.schedule || [];
  const useSchedule = schedule.length > 0;

  return (
    <>
      <div className={sectionCls}>
        <SectionHeading icon={Clock} accent={theme.accent} iconBg={theme.iconBg} iconColor={theme.iconColor}>
          How & When Do People Arrive?
        </SectionHeading>

        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div>
            <label className="text-[12.5px] font-bold text-gray-900 block leading-tight">Continuous Arrivals</label>
            <span className="text-[11px] text-gray-400">Keep sending people in for the whole simulation</span>
          </div>
          <Switch
            checked={!!params.infiniteArrivals}
            onChange={(v) => setParam("infiniteArrivals", v)}
            label="Infinite Arrivals"
          />
        </div>

        {!params.infiniteArrivals && (
          <div>
            <label className={labelCls}>Maximum People / Items Allowed</label>
            <input
              type="number"
              min={1}
              value={params.maxEntities || ""}
              onChange={(e) =>
                setParam("maxEntities", e.target.value === "" ? undefined : Number(e.target.value))
              }
              placeholder="Unlimited (e.g. 100)"
              className={modernInputCls}
            />
          </div>
        )}

        {/* Segmented Mode Button Pill */}
        <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200/60 mt-2">
          {["Paced Arrivals", "Exact Time Schedule"].map((mode) => {
            const isSchedule = mode === "Exact Time Schedule";
            const active = isSchedule ? useSchedule : !useSchedule;
            return (
              <button
                key={mode}
                onClick={() => {
                  if (isSchedule && !useSchedule) setParam("schedule", [{ simTime: 0, count: 1 }]);
                  if (!isSchedule && useSchedule) setParam("schedule", []);
                }}
                className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all ${
                  active ? "bg-white text-[#5742FF] shadow-xs" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>

        {!useSchedule ? (
          <>
            <div>
              <label className={labelCls}>Arrival Pattern (How do they show up?)</label>
              <CustomSelect
                value={params.distribution || "exponential"}
                onChange={(v) => setParam("distribution", v)}
                options={ARRIVAL_DISTRIBUTIONS}
              />
            </div>
            <div>
              <label className={labelCls}>Arrival Speed (People per second)</label>
              <input
                type="number"
                min={0.0001}
                step={0.1}
                value={params.arrivalRate ?? 1}
                onChange={(e) => setParam("arrivalRate", Number(e.target.value))}
                className={modernInputCls}
              />
            </div>
          </>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className={labelCls}>Timetable Schedule</label>
              <button
                onClick={() => setParam("schedule", [...schedule, { simTime: 0, count: 1 }])}
                className="text-[11px] font-bold text-[#5742FF] hover:underline flex items-center gap-1"
              >
                <Plus size={12} /> Add Arrival
              </button>
            </div>
            {schedule.map((entry, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <input
                  type="number"
                  min={0}
                  value={entry.simTime}
                  onChange={(e) => {
                    const s = [...schedule];
                    s[idx].simTime = Number(e.target.value);
                    setParam("schedule", s);
                  }}
                  placeholder="At second"
                  className={modernInputCls}
                />
                <input
                  type="number"
                  min={1}
                  value={entry.count}
                  onChange={(e) => {
                    const s = [...schedule];
                    s[idx].count = Number(e.target.value);
                    setParam("schedule", s);
                  }}
                  placeholder="How many"
                  className={modernInputCls}
                />
                <button
                  onClick={() => setParam("schedule", schedule.filter((_, i) => i !== idx))}
                  className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={sectionCls}>
        <SectionHeading icon={Users} accent={theme.accent} iconBg={theme.iconBg} iconColor={theme.iconColor}>
          Who / What Is Arriving?
        </SectionHeading>
        <div>
          <label className={labelCls}>Item or Person Name</label>
          <input
            type="text"
            value={params.entityClass || "standard"}
            onChange={(e) => setParam("entityClass", e.target.value)}
            placeholder="e.g. Customer, Vehicle, Parcel"
            className={modernInputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Urgency / Priority Tier</label>
          <CustomSelect
            value={params.priorityLevel || "standard"}
            onChange={(v) => setParam("priorityLevel", v)}
            options={PRIORITY_TIERS}
          />
        </div>
      </div>
    </>
  );
}

// ─── 2. Queue (Waiting Line) ────────────────────────────────────
function QueueProperties({ params, nodeId, onUpdate, theme }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Clock} accent={theme.accent} iconBg={theme.iconBg} iconColor={theme.iconColor}>
        Waiting Line & Queue Rules
      </SectionHeading>

      <div>
        <label className={labelCls}>Maximum Line Capacity (-1 for unlimited)</label>
        <input
          type="number"
          value={params.capacity ?? -1}
          onChange={(e) => setParam("capacity", Number(e.target.value))}
          placeholder="-1 for infinite line"
          className={modernInputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Who Gets Served First?</label>
        <CustomSelect
          value={params.discipline || "FIFO"}
          onChange={(v) => setParam("discipline", v)}
          options={QUEUE_DISCIPLINES}
        />
      </div>

      <div className="pt-3 border-t border-gray-100 space-y-3">
        <label className={labelCls}>Will People Give Up & Leave The Line?</label>
        <CustomSelect
          value={params.patienceDistribution || "none"}
          onChange={(v) => {
            if (v === "none") {
              const p = { ...params };
              delete p.patienceDistribution;
              onUpdate(nodeId, { params: p });
            } else {
              setParam("patienceDistribution", v);
            }
          }}
          options={PATIENCE_MODELS}
        />

        {params.patienceDistribution && params.patienceDistribution !== "none" && (
          <div>
            <label className={labelCls}>Average Patience Time (seconds before leaving)</label>
            <input
              type="number"
              value={params.patienceTimeout ?? 5}
              onChange={(e) => setParam("patienceTimeout", Number(e.target.value))}
              className={modernInputCls}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 3 & 10. Resource / Priority Resource (Staff/Machine) ───────
function ResourceProperties({ params, nodeId, onUpdate, theme, isPriorityNode }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Server} accent={theme.accent} iconBg={theme.iconBg} iconColor={theme.iconColor}>
        Staff & Counter Capacity
      </SectionHeading>

      <div>
        <label className={labelCls}>Number of Staff / Parallel Counters</label>
        <input
          type="number"
          min={1}
          value={params.capacity ?? 1}
          onChange={(e) => setParam("capacity", Number(e.target.value))}
          className={modernInputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Average Time to Serve One Person (seconds)</label>
        <input
          type="number"
          min={0}
          step={0.1}
          value={params.serviceTimeMean ?? 1}
          onChange={(e) => setParam("serviceTimeMean", Number(e.target.value))}
          className={modernInputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Service Speed Consistency</label>
        <CustomSelect
          value={params.serviceDistribution || "exponential"}
          onChange={(v) => setParam("serviceDistribution", v)}
          options={SERVICE_DISTRIBUTIONS}
        />
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
        <div>
          <label className="text-[12.5px] font-bold text-gray-900 block leading-tight">Fast-Track Override</label>
          <span className="text-[11px] text-gray-400">Pause regular work to handle urgent VIPs</span>
        </div>
        <Switch
          checked={!!params.isPreemptive}
          onChange={(v) => setParam("isPreemptive", v)}
          label="Can interrupt lower-priority work"
        />
      </div>

      <div className="pt-3 border-t border-gray-100 space-y-3">
        <label className={labelCls}>How Often Does This Station Break Down? (MTBF)</label>
        <input
          type="number"
          min={0}
          value={params.meanTimeBetweenFailures ?? ""}
          placeholder="Never breaks down (Leave empty)"
          onChange={(e) =>
            setParam("meanTimeBetweenFailures", e.target.value ? Number(e.target.value) : undefined)
          }
          className={modernInputCls}
        />

        {params.meanTimeBetweenFailures > 0 && (
          <div>
            <label className={labelCls}>Average Time to Fix / Repair (seconds)</label>
            <input
              type="number"
              min={0}
              value={params.repairTimeMean ?? 1}
              onChange={(e) => setParam("repairTimeMean", Number(e.target.value))}
              className={modernInputCls}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 4. Service (Processing Step) ───────────────────────────────
function ServiceProperties({ params, nodeId, onUpdate, theme }: any) {
  function setParam(key: string, value: any) {
    onUpdate(nodeId, { params: { ...params, [key]: value } });
  }
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Activity} accent={theme.accent} iconBg={theme.iconBg} iconColor={theme.iconColor}>
        Processing Speed & Duration
      </SectionHeading>
      <div>
        <label className={labelCls}>Average Duration (seconds)</label>
        <input
          type="number"
          min={0}
          step={0.1}
          value={params.durationMean ?? 1}
          onChange={(e) => setParam("durationMean", Number(e.target.value))}
          className={modernInputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Speed Consistency</label>
        <CustomSelect
          value={params.distribution || "exponential"}
          onChange={(v) => setParam("distribution", v)}
          options={SERVICE_DISTRIBUTIONS}
        />
      </div>
    </div>
  );
}

// ─── 5. Decision (Split Path) ───────────────────────────────────
function DecisionProperties({ params, nodeId, onUpdate, theme }: any) {
  const routes: { targetId: string; probability: number }[] = params.routes || [];
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Route} accent={theme.accent} iconBg={theme.iconBg} iconColor={theme.iconColor}>
        Branch Routing (Where do they go?)
      </SectionHeading>
      <div className="flex justify-between items-center mb-2">
        <label className={labelCls}>Outgoing Paths</label>
        <button
          onClick={() =>
            onUpdate(nodeId, {
              params: { ...params, routes: [...routes, { targetId: "", probability: 0.5 }] },
            })
          }
          className="text-[11px] font-bold text-[#5742FF] hover:underline flex items-center gap-1"
        >
          <Plus size={12} /> Add Path
        </button>
      </div>
      {routes.map((route, idx) => (
        <div key={idx} className="flex gap-2 mb-2 items-center">
          <input
            type="text"
            value={route.targetId}
            onChange={(e) => {
              const r = [...routes];
              r[idx].targetId = e.target.value;
              onUpdate(nodeId, { params: { ...params, routes: r } });
            }}
            placeholder="Target Station Name"
            className={modernInputCls}
          />
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={route.probability}
            onChange={(e) => {
              const r = [...routes];
              r[idx].probability = Number(e.target.value);
              onUpdate(nodeId, { params: { ...params, routes: r } });
            }}
            placeholder="Chances (0-1)"
            className={modernInputCls}
          />
          <button
            onClick={() => {
              onUpdate(nodeId, { params: { ...params, routes: routes.filter((_, i) => i !== idx) } });
            }}
            className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {routes.length === 0 && (
        <p className="text-[11.5px] text-gray-400 p-2.5 text-center bg-gray-50 rounded-xl">
          Connect outgoing arrows from this node on the canvas to set split percentages.
        </p>
      )}
    </div>
  );
}

// ─── 6. Sink (Exit Point) ───────────────────────────────────────
function SinkProperties({ params, nodeId, onUpdate, theme }: any) {
  return (
    <div className={sectionCls}>
      <SectionHeading icon={Target} accent={theme.accent} iconBg={theme.iconBg} iconColor={theme.iconColor}>
        Exit & Completion Settings
      </SectionHeading>
      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
        <div>
          <label className="text-[12.5px] font-bold text-gray-900 block leading-tight">Record Final Score</label>
          <span className="text-[11px] text-gray-400">Include items exiting here in the completion report</span>
        </div>
        <Switch
          checked={params.collectKPIs !== false}
          onChange={(v) => onUpdate(nodeId, { params: { ...params, collectKPIs: v } })}
          label="Collect KPIs"
        />
      </div>
    </div>
  );
}

// ─── Main Configuration Panel ───────────────────────────────────
export default function NodePropertiesPanel({ node, simType, onUpdate }: NodePropertiesPanelProps) {
  if (!node) return null;

  const data = node.data || {};
  const { nodeType, label, params } = data as any;
  const theme = NODE_THEMES[nodeType] || NODE_THEMES.service;
  const IconComp = theme.icon;

  return (
    <div className="h-full flex flex-col bg-[#FAF9FF] text-[#111827]">
      {/* ── 1. Hero Block Identity Card (Bold & Vibrant Header) ── */}
      <div className="p-4 bg-white border-b border-indigo-100/70 shadow-xs">
        <div className="flex items-start gap-3.5">
          {/* Vibrant Category Icon Box */}
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 ${theme.iconBg} ${theme.iconColor} shadow-xs border border-white`}
          >
            <IconComp size={22} strokeWidth={2.3} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border ${theme.badgeBg} ${theme.badgeText}`}
              >
                {theme.category}
              </span>
              <span className="text-[11px] font-bold text-gray-400 truncate">ID: {node.id}</span>
            </div>

            <div className="mt-1">
              <input
                type="text"
                value={label || ""}
                onChange={(e) => onUpdate(node.id, { label: e.target.value })}
                placeholder="Station Name"
                className="text-[16px] font-black text-gray-900 tracking-tight bg-transparent hover:bg-gray-50 focus:bg-white px-2 py-0.5 -ml-2 rounded-lg border border-transparent focus:border-[#5742FF] focus:ring-2 focus:ring-indigo-50 outline-none transition-all w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Scrollable Configuration Sections ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 pb-20 space-y-4">
        {nodeType === "source" && (
          <SourceProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} theme={theme} />
        )}
        {nodeType === "queue" && (
          <QueueProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} theme={theme} />
        )}
        {nodeType === "resource" && (
          <ResourceProperties
            params={params || {}}
            nodeId={node.id}
            onUpdate={onUpdate}
            isPriorityNode={false}
            theme={theme}
          />
        )}
        {nodeType === "priority_resource" && (
          <ResourceProperties
            params={params || {}}
            nodeId={node.id}
            onUpdate={onUpdate}
            isPriorityNode={true}
            theme={theme}
          />
        )}
        {nodeType === "service" && (
          <ServiceProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} theme={theme} />
        )}
        {nodeType === "decision" && (
          <DecisionProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} theme={theme} />
        )}
        {nodeType === "sink" && (
          <SinkProperties params={params || {}} nodeId={node.id} onUpdate={onUpdate} theme={theme} />
        )}
      </div>

      {/* ── 3. Footer Quick Info ── */}
      <div className="p-3.5 bg-white border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
        <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
          <CheckCircle2 size={13} /> Changes Saved
        </span>
        <span className="text-gray-400">{theme.label}</span>
      </div>
    </div>
  );
}
