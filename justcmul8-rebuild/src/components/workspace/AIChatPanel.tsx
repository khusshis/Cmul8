"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Send,
  Sparkles,
  Zap,
  RotateCcw,
  CheckCircle2,
  Layers,
  ArrowRight,
  Coffee,
  HeartPulse,
  Package,
  Building2,
  Sliders,
  Flame,
  LayoutGrid,
  Bot,
  Info,
  ChevronRight,
  Check,
  Undo2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { applyDagreLayout } from "@/lib/simulation/layoutEngine";
import { applyAIOps, normalizeAIResponse, snapshotForHistory, type AIGraphOps } from "@/lib/ai/graphOps";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MarkdownMessage({ content, isUser }: { content: string; isUser?: boolean }) {
  if (isUser) {
    return <div className="whitespace-pre-wrap font-medium">{content}</div>;
  }

  return (
    <div className="text-[12px] leading-relaxed select-text break-words space-y-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[13.5px] font-black text-gray-900 mt-2 mb-1 tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[13px] font-black text-gray-900 mt-2 mb-1 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[12px] font-black text-[#4338CA] mt-2 mb-0.5 tracking-tight flex items-center gap-1">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[11.5px] font-black text-gray-900 mt-1 mb-0.5">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[12px] text-gray-800 leading-relaxed my-1">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-gray-950">
              {children}
            </strong>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-4 space-y-1 my-1 text-[11.5px] marker:text-[#6366F1]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 space-y-1 my-1 text-[11.5px] marker:text-[#6366F1] font-semibold">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5 text-gray-800 font-normal">
              {children}
            </li>
          ),
          code: ({ className, children, ...props }: any) => {
            const isInline = !className?.includes("language-");
            return isInline ? (
              <code
                className="px-1.5 py-0.5 rounded bg-indigo-50 text-[#4F46E5] font-mono text-[11px] font-semibold border border-indigo-100/70"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-[#181825] text-indigo-100 p-2.5 rounded-xl font-mono text-[11px] overflow-x-auto my-1.5 shadow-inner border border-slate-800">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#6366F1] bg-indigo-50/50 pl-2.5 py-1 my-1.5 rounded-r text-[11.5px] text-indigo-900 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1 bg-gray-50 font-bold text-gray-700 text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 border-t border-gray-100 text-gray-800">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Client-side ceiling; the route itself allows up to 120 s for model fallbacks. */
const CHAT_REQUEST_TIMEOUT_MS = 110_000;
const MAX_WARNINGS_SHOWN = 4;

const LAYOUT_OPTIONS = { direction: "LR" as const, nodeWidth: 210, nodeHeight: 90, rankSep: 90, nodeSep: 60 };

/**
 * The route only reads summary telemetry, so never upload logs or entity
 * journeys: on a long run those are several megabytes per chat message.
 */
function slimSimResult(r: SimResult | null | undefined) {
  if (!r) return undefined;
  const { logs, entityJourneys, topSlowestEntities, timeline, ...summary } = r as any;
  void logs; void entityJourneys; void topSlowestEntities; void timeline;
  return summary;
}

function withWarnings(text: string, warnings: string[] | undefined) {
  if (!warnings || warnings.length === 0) return text;
  const shown = warnings.slice(0, MAX_WARNINGS_SHOWN).map((w) => `- ${w}`).join("\n");
  const more = warnings.length > MAX_WARNINGS_SHOWN ? `\n- …and ${warnings.length - MAX_WARNINGS_SHOWN} more` : "";
  return `${text}\n\n**Adjusted to keep the model valid:**\n${shown}${more}`;
}
import type { SimResult, SimTypeId } from "@/lib/simulation/types";

export interface AIChatPanelProps {
  project: { id: string; name: string; sim_type: string };
  nodes: any[];
  edges: any[];
  selectedNodeId?: string | null;
  simResult?: SimResult | null;
  simState?: "idle" | "running" | "paused";
  onApplyChanges: (nodes: any[], edges: any[]) => void;
  onSelectNode?: (nodeId: string | null) => void;
}

// ─── Custom Glowing AI Copilot Avatar Icon ─────────────────────
function CustomAIBotAvatar({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div
      className={`${className} rounded-full bg-gradient-to-tr from-[#5742FF] via-[#7B61FF] to-[#00E5FF] p-[1.5px] shadow-[0_2px_8px_rgba(87,66,255,0.35)] shrink-0 flex items-center justify-center`}
    >
      <div className="w-full h-full bg-[#111029] rounded-full flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5">
          <path
            d="M12 2C12 7.5 7.5 12 2 12C7.5 12 12 16.5 12 22C12 16.5 16.5 12 22 12C16.5 12 12 7.5 12 2Z"
            fill="url(#bot-spark-grad)"
          />
          <circle cx="12" cy="12" r="1.8" fill="#FFFFFF" />
          <circle cx="18" cy="6" r="1.2" fill="#00E5FF" />
          <circle cx="6" cy="18" r="1.2" fill="#7B61FF" />
          <defs>
            <linearGradient id="bot-spark-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00E5FF" />
              <stop offset="0.5" stopColor="#7B61FF" />
              <stop offset="1" stopColor="#FF61D2" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

// ─── Quick Start Starter Prompts for Empty Canvas ────────────────
const STARTER_PROMPTS = [
  {
    icon: Coffee,
    title: "Coffee Shop Drive-Thru",
    prompt: "Create a coffee shop simulation with an order station, 2 barista service counters, and a customer pickup area with morning burst arrivals.",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    icon: HeartPulse,
    title: "Hospital Emergency Room",
    prompt: "Design an emergency triage with a standard queue, a VIP fast-track priority lane, 3 doctors, and a recovery sink.",
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    icon: Package,
    title: "E-Commerce Fulfillment",
    prompt: "Build a warehouse packing workflow: order intake, sorting station, packaging queue, quality inspection (10% rework), and dispatch routing.",
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    icon: Building2,
    title: "Bank Customer Desks",
    prompt: "Create a bank lobby with a single waiting line, 4 teller desks, and customer patience timeout where people leave after long waits.",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
];

export default function AIChatPanel({
  project,
  nodes,
  edges,
  selectedNodeId,
  simResult,
  simState = "idle",
  onApplyChanges,
  onSelectNode,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // The model can take a while and the user may keep editing meanwhile. Apply the
  // AI's edit to the canvas as it is when the reply ARRIVES, not as it was when sent.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Load chat history from Supabase
  useEffect(() => {
    async function loadChat() {
      if (!project.id) return;
      const { data, error } = await supabase
        .from("chat_history")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
      setLoading(false);
    }
    loadChat();
  }, [project.id, supabase]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, generating]);

  // Restore a saved version (the "apply" button on a past AI message). This is an
  // explicit, user-clicked full restore, so it replaces the canvas, but it still
  // goes through validation so a malformed saved graph cannot corrupt the model.
  const handleApplyGraphToCanvas = (rawNodes: any[], rawEdges: any[]) => {
    if (!rawNodes || rawNodes.length === 0) return;
    const { ops, warnings } = normalizeAIResponse(
      { actionType: "REPLACE_GRAPH", graph: { nodes: rawNodes, edges: rawEdges || [] } },
      0,
      "restore"
    );
    const applied = applyAIOps(nodesRef.current, edgesRef.current, ops);
    if (!applied.changed) {
      toast.error("That saved version has no valid blocks to restore.");
      return;
    }
    const { nodes: laidOutNodes, edges: laidOutEdges } = applyDagreLayout(applied.nodes, applied.edges, LAYOUT_OPTIONS);
    onApplyChanges(laidOutNodes, laidOutEdges);
    const fixes = warnings.length + applied.warnings.length;
    toast.success(
      `Canvas updated with ${laidOutNodes.length} stations and ${laidOutEdges.length} links${fixes ? ` (${fixes} fixes applied)` : ""}`,
      "AI Network Applied"
    );
  };

  /**
   * Restores a saved snapshot wholesale. Unlike the AI edit path this is always a
   * user-initiated replace, and it must be able to restore an EMPTY canvas — undoing
   * a "build me a model" step means going back to nothing.
   */
  const restoreSnapshot = (
    snapshot: { nodes?: any[]; edges?: any[] } | undefined,
    title: string
  ) => {
    if (!snapshot) return;
    const rawNodes = snapshot.nodes || [];
    if (rawNodes.length === 0) {
      onApplyChanges([], []);
      toast.success("Canvas cleared back to its earlier state", title);
      return;
    }
    const { ops, warnings } = normalizeAIResponse(
      { actionType: "REPLACE_GRAPH", graph: { nodes: rawNodes, edges: snapshot.edges || [] } },
      0,
      "restore"
    );
    const applied = applyAIOps(nodesRef.current, edgesRef.current, ops);
    if (!applied.changed) {
      toast.error("That saved version has no valid blocks to restore.");
      return;
    }
    // Snapshots carry coordinates, so a restore normally needs no re-layout —
    // undo should not rearrange blocks the user placed by hand.
    const next = applied.needsFullLayout
      ? applyDagreLayout(applied.nodes, applied.edges, LAYOUT_OPTIONS)
      : { nodes: applied.nodes, edges: applied.edges };
    onApplyChanges(next.nodes, next.edges);
    const fixes = warnings.length + applied.warnings.length;
    toast.success(
      `Canvas restored to ${next.nodes.length} stations and ${next.edges.length} links${fixes ? ` (${fixes} fixes applied)` : ""}`,
      title
    );
  };

  /** Applies a validated op set from the AI to the live canvas. Returns before/after snapshots. */
  const applyOpsToCanvas = (ops: AIGraphOps | null | undefined) => {
    const nothing = { snapshot: undefined, before: undefined, warnings: [] as string[] };
    if (!ops || ops.actionType === "NONE") return nothing;
    // Captured before the edit so the message can offer a one-click undo.
    const before = snapshotForHistory(nodesRef.current, edgesRef.current);
    const applied = applyAIOps(nodesRef.current, edgesRef.current, ops);
    if (!applied.changed) return { ...nothing, warnings: applied.warnings };

    const next = applied.needsFullLayout
      ? applyDagreLayout(applied.nodes, applied.edges, LAYOUT_OPTIONS)
      : { nodes: applied.nodes, edges: applied.edges };

    onApplyChanges(next.nodes, next.edges);

    if (ops.actionType === "AUTO_LAYOUT") {
      toast.success("Organized stations cleanly on canvas", "Auto-Layout Complete");
    } else {
      toast.success(`Canvas updated with ${next.nodes.length} stations and ${next.edges.length} links`, "AI Network Applied");
    }
    return { snapshot: snapshotForHistory(next.nodes, next.edges), before, warnings: applied.warnings };
  };

  // Trigger quick Dagre auto layout of existing canvas
  const handleAutoLayoutCurrentCanvas = () => {
    if (nodes.length === 0) return;
    const { nodes: laidOutNodes, edges: laidOutEdges } = applyDagreLayout(nodes, edges, {
      direction: "LR",
      nodeWidth: 210,
      nodeHeight: 90,
      rankSep: 90,
      nodeSep: 60,
    });
    onApplyChanges(laidOutNodes, laidOutEdges);
    toast.success("Organized stations cleanly on canvas", "Auto-Layout Complete");
  };

  // Send message to AI Chatbot API
  async function sendMessage(
    textToSend: string,
    opts: { echoUser?: boolean; clearMessageId?: string } = {}
  ) {
    if (!textToSend.trim() || generating) return;
    const echoUser = opts.echoUser !== false;

    const { data: { user } } = await supabase.auth.getUser();

    const userMessage: {
      project_id: string;
      user_id?: string;
      role: "user" | "assistant";
      content: string;
      metadata?: any;
    } = {
      project_id: project.id,
      ...(user?.id ? { user_id: user.id } : {}),
      role: "user",
      content: textToSend,
    };

    const tempId = Date.now().toString();
    // Errors are transient UI, and the prompt being retried is passed separately,
    // so neither belongs in the history sent to the model.
    const historyForRequest = messages
      .filter((m) => !m.isError)
      .filter((m, i, all) => !(i === all.length - 1 && m.role === "user" && m.content === textToSend))
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => {
      const cleared = opts.clearMessageId ? prev.filter((m) => m.id !== opts.clearMessageId) : prev;
      return echoUser ? [...cleared, { ...userMessage, id: tempId }] : cleared;
    });
    if (echoUser) setInput("");
    setGenerating(true);

    const showAssistantError = (content: string) =>
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content, isError: true, retryPrompt: textToSend },
      ]);

    // Persisting the user message must never block or break the AI call.
    if (echoUser) {
      supabase.from("chat_history").insert(userMessage).then(({ error }) => {
        if (error) console.warn("[AIChatPanel] could not save user message:", error.message);
      });
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CHAT_REQUEST_TIMEOUT_MS);

    let appliedToCanvas = false;
    try {
      let res: Response;
      try {
        res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: textToSend,
            simType: project.sim_type,
            conversationHistory: historyForRequest,
            currentGraph: { nodes: nodesRef.current, edges: edgesRef.current },
            selectedNodeId: selectedNodeId || undefined,
            simResult: slimSimResult(simResult),
            simState,
          }),
        });
      } catch {
        if (controller.signal.aborted && !timedOut) return; // panel unmounted
        showAssistantError(
          timedOut
            ? "The assistant took too long to respond. Please try again; a shorter or more specific request usually helps."
            : "I couldn't reach the server. Please check your internet connection and try again."
        );
        return;
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        /* non-JSON body, handled below */
      }

      if (!res.ok || !data || data.ok === false) {
        // The server returns a specific, user-facing reason (quota, timeout, sign-in...).
        showAssistantError(
          (data && typeof data.text === "string" && data.text) ||
            `The assistant is unavailable right now (error ${res.status}). Please try again in a moment.`
        );
        return;
      }

      // Apply the validated edit first, so the saved card holds the real post-edit state.
      const { snapshot, before, warnings: applyWarnings } = applyOpsToCanvas(data.ops);
      appliedToCanvas = snapshot !== undefined;
      const allWarnings = [...(Array.isArray(data.warnings) ? data.warnings : []), ...applyWarnings];

      const assistantMessage = {
        project_id: project.id,
        ...(user?.id ? { user_id: user.id } : {}),
        role: "assistant" as const,
        content: withWarnings(data.text || "Simulation plan updated.", allWarnings),
        metadata: {
          actionType: data.actionType,
          graph: snapshot,
          modifiedNodeIds: data.modifiedNodeIds,
          /** Canvas as it was before this edit, so the message can offer an undo. */
          graphBefore: before,
          simulationInsights: data.simulationInsights,
          suggestedQuestions: data.suggestedQuestions,
        },
      };

      const { data: savedMsg, error: saveError } = await supabase
        .from("chat_history")
        .insert(assistantMessage)
        .select()
        .single();
      if (saveError) console.warn("[AIChatPanel] could not save assistant message:", saveError.message);
      setMessages((prev) => [...prev, savedMsg || { ...assistantMessage, id: `local-${Date.now()}` }]);
    } catch (err) {
      console.error("[AIChatPanel] unexpected error", err);
      showAssistantError(
        appliedToCanvas
          ? "Your canvas was updated, but this reply couldn't be saved to the chat history."
          : "Something went wrong while applying the assistant's changes. Your canvas was not modified."
      );
    } finally {
      clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
      setGenerating(false);
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  const confirmClearChat = async () => {
    try {
      await supabase.from("chat_history").delete().eq("project_id", project.id);
      setMessages([]);
      setShowClearConfirm(false);
      toast.success("AI conversation history cleared", "Reset Complete");
    } catch (err) {
      toast.error("Failed to clear chat history");
    }
  };

  // Context-aware dynamic suggestions
  const contextualChips = useMemo(() => {
    const chips: Array<{ label: string; prompt: string; icon: any }> = [];

    if (nodes.length === 0) {
      return [
        { label: "Coffee Shop", prompt: "Create a coffee shop simulation with 2 baristas and a morning rush queue.", icon: Coffee },
        { label: "Hospital ER", prompt: "Design an emergency triage with 3 doctors and urgent queue.", icon: HeartPulse },
        { label: "Bank Lobby", prompt: "Build a bank lobby with 4 tellers and a customer line.", icon: Building2 },
      ];
    }

    if (simResult?.bottleneckNodeId) {
      const bNode = nodes.find((n) => n.id === simResult.bottleneckNodeId);
      const bLabel = bNode?.data?.label || "bottleneck station";
      chips.push({
        label: `Fix ${bLabel} Jam`,
        prompt: `How can I eliminate the bottleneck at ${bLabel} and reduce customer waiting time?`,
        icon: Flame,
      });
    }

    if (selectedNode) {
      chips.push({
        label: `Inspect ${selectedNode.data?.label || "Block"}`,
        prompt: `Analyze the configuration and role of ${selectedNode.data?.label || selectedNode.id} in this flow.`,
        icon: Info,
      });
      chips.push({
        label: `Double Capacity`,
        prompt: `Double the capacity or throughput of ${selectedNode.data?.label || selectedNode.id}.`,
        icon: Sliders,
      });
    }

    chips.push({
      label: "Optimize Flow",
      prompt: "Analyze my whole simulation network and optimize it for maximum throughput with minimal wait time.",
      icon: Zap,
    });

    chips.push({
      label: "Stress Test",
      prompt: "Suggest a stress-test arrival rate to identify the weak points of this architecture.",
      icon: Layers,
    });

    return chips.slice(0, 3);
  }, [nodes, simResult, selectedNode]);

  if (loading) {
    return (
      <div className="w-full h-full bg-[#FAF9FF] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#6366F1]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
        <p className="text-[12px] font-semibold text-gray-400">Loading AI Assistant...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#FAF9FF] text-[#111827] overflow-hidden select-none">
      {/* ── Context & Telemetry Inspector Bar ── */}
      <div className="px-3.5 py-2.5 bg-white border-b border-indigo-100/70 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100/80 text-[10.5px] font-extrabold text-[#5742FF] flex items-center gap-1 shrink-0">
            <Layers size={11} /> {nodes.length} Blocks
          </span>
          <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200/80 text-[10.5px] font-extrabold text-gray-600 flex items-center gap-1 shrink-0">
            <Zap size={11} className="text-amber-500" /> {edges.length} Links
          </span>
          {selectedNode && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10.5px] font-extrabold text-emerald-700 truncate max-w-[110px] shrink-0">
              📍 {selectedNode.data?.label || selectedNode.id}
            </span>
          )}
          {simResult && (
            <span
              className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold shrink-0 ${
                (simResult.healthScore ?? 100) >= 80
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              Grade {(simResult.healthScore ?? 100) >= 80 ? "A" : "B"}
            </span>
          )}
        </div>

        {nodes.length > 0 && (
          <button
            onClick={handleAutoLayoutCurrentCanvas}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#5742FF] hover:bg-indigo-50 transition-colors shrink-0"
            title="Auto-Arrange Canvas Layout"
          >
            <LayoutGrid size={14} />
          </button>
        )}
      </div>

      {/* ── Chat Messages Scroll Container ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3.5 space-y-3.5" ref={scrollRef}>
        {messages.length === 0 ? (
          /* ── Hero Empty State with Interactive Starter Cards ── */
          <div className="py-3 space-y-4 animate-in fade-in duration-300">
            <div className="text-center space-y-1.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-500/20">
                <Sparkles size={20} />
              </div>
              <h3 className="text-[14.5px] font-black text-gray-900 tracking-tight">AI Simulation Architect</h3>
              <p className="text-[11.5px] text-gray-500 max-w-[260px] mx-auto leading-relaxed">
                Describe any workflow or system. I will design blocks, configure parameters, and optimize throughput.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block px-1">
                Quick Start Scenarios
              </span>

              <div className="space-y-2">
                {STARTER_PROMPTS.map((item, idx) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendMessage(item.prompt)}
                      disabled={generating}
                      className="w-full p-2.5 rounded-xl bg-white border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 text-left transition-all group flex items-start gap-2.5 shadow-2xs"
                    >
                      <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${item.color}`}>
                        <IconComp size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] font-bold text-gray-900 group-hover:text-[#6366F1] flex items-center justify-between">
                          <span>{item.title}</span>
                          <ArrowRight
                            size={12}
                            className="text-gray-300 group-hover:text-[#6366F1] group-hover:translate-x-0.5 transition-all"
                          />
                        </div>
                        <p className="text-[10.5px] text-gray-400 line-clamp-1 mt-0.5">{item.prompt}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ── Message Thread ── */
          <div className="space-y-3 pb-2">
            {messages.map((m) => {
              const isUser = m.role === "user";
              const metadata = m.metadata || {};
              const stationCount = metadata.graph?.nodes?.length ?? 0;
              const canApply = stationCount > 0;
              const canUndo = !!metadata.graphBefore;
              const hasGraph = canApply || canUndo;
              const insights = metadata.simulationInsights;
              const riskTone =
                insights?.bottleneckRisk === "Critical"
                  ? "text-rose-600 bg-rose-50 border-rose-200"
                  : insights?.bottleneckRisk === "Moderate"
                    ? "text-amber-600 bg-amber-50 border-amber-200"
                    : "text-emerald-600 bg-emerald-50 border-emerald-200";

              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-end gap-1.5 max-w-[92%]">
                    {!isUser && <CustomAIBotAvatar className="w-5 h-5 mb-1" />}

                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed select-text ${
                        isUser
                          ? "bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white rounded-br-xs font-medium shadow-xs"
                          : "bg-white border border-indigo-100/70 text-gray-800 rounded-bl-xs shadow-2xs"
                      }`}
                    >
                      <MarkdownMessage content={m.content} isUser={isUser} />
                    </div>
                  </div>

                  {/* Interactive Action / Graph Preview Card */}
                  {hasGraph && (
                    <div className="mt-2 ml-6 p-2.5 rounded-xl bg-white border border-indigo-100/90 shadow-2xs max-w-[88%] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-indigo-700 font-extrabold text-[11px]">
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          <span>Simulation Architecture Generated</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {metadata.actionType || "Updated"}
                        </span>
                      </div>

                      {canApply && (
                        <div className="flex items-center gap-3 text-[10.5px] text-gray-500 font-semibold bg-gray-50/80 p-1.5 rounded-lg">
                          <span className="flex items-center gap-1">
                            <Layers size={12} className="text-[#6366F1]" /> {stationCount} Stations
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap size={12} className="text-amber-500" /> {metadata.graph.edges?.length || 0} Links
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        {canApply && (
                          <button
                            onClick={() => handleApplyGraphToCanvas(metadata.graph.nodes, metadata.graph.edges || [])}
                            className="flex-1 py-1.5 text-[11px] font-extrabold bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-[#5742FF] hover:to-[#7C3AED] text-[#5742FF] hover:text-white border border-indigo-200/80 rounded-lg shadow-2xs transition-all duration-200 flex items-center justify-center gap-1.5"
                          >
                            <Check size={12} />
                            <span>Apply / Re-Align Canvas</span>
                          </button>
                        )}
                        {canUndo && (
                          <button
                            onClick={() => restoreSnapshot(metadata.graphBefore, "Change Undone")}
                            title="Put the canvas back as it was before this change"
                            className={`${canApply ? "px-2.5" : "flex-1"} py-1.5 text-[11px] font-extrabold bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg shadow-2xs transition-all duration-200 flex items-center justify-center gap-1.5`}
                          >
                            <Undo2 size={12} />
                            <span>Undo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Simulation Insights (megaprompt simulationInsights block) */}
                  {insights && (
                    <div className="mt-2 ml-6 p-2.5 rounded-xl bg-white border border-indigo-100/90 shadow-2xs max-w-[88%] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-indigo-700 font-extrabold text-[11px]">
                          <Sliders size={13} className="text-[#6366F1]" />
                          <span>Simulation Insights</span>
                        </div>
                        {insights.bottleneckRisk && (
                          <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${riskTone}`}>
                            {insights.bottleneckRisk} Risk
                          </span>
                        )}
                      </div>

                      {insights.estimatedThroughput && (
                        <div className="flex items-center gap-1.5 text-[10.5px] text-gray-500 font-semibold bg-gray-50/80 p-1.5 rounded-lg">
                          <Flame size={12} className="text-amber-500" />
                          <span className="text-gray-700">{insights.estimatedThroughput}</span>
                        </div>
                      )}

                      {insights.keyRecommendation && (
                        <p className="text-[11px] leading-relaxed text-gray-600 px-0.5">
                          {insights.keyRecommendation}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Retry a failed request without retyping it */}
                  {m.isError && m.retryPrompt && (
                    <div className="mt-2 ml-6 max-w-[88%]">
                      <button
                        onClick={() => sendMessage(m.retryPrompt, { echoUser: false, clearMessageId: m.id })}
                        disabled={generating}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50/60 text-[#5742FF] text-[10.5px] font-bold border border-indigo-100 shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <RotateCcw size={11} />
                        <span>Try again</span>
                      </button>
                    </div>
                  )}

                  {/* Follow-up Suggested Quick Chips */}
                  {metadata.suggestedQuestions && metadata.suggestedQuestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-6 max-w-[88%]">
                      {metadata.suggestedQuestions.map((q: string, qIdx: number) => (
                        <button
                          key={qIdx}
                          onClick={() => sendMessage(q)}
                          disabled={generating}
                          className="px-2 py-1 rounded-lg bg-indigo-50/70 hover:bg-indigo-100/90 text-[#5742FF] text-[10px] font-bold border border-indigo-100 transition-colors flex items-center gap-1"
                        >
                          <span>{q}</span>
                          <ChevronRight size={10} />
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* AI Generating Indicator */}
            {generating && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2">
                <CustomAIBotAvatar className="w-5 h-5 mt-0.5" />
                <div className="px-3 py-2 rounded-2xl rounded-bl-xs bg-white border border-indigo-100 text-[11.5px] font-semibold text-gray-600 flex items-center gap-2 shadow-2xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6366F1]" />
                  <span>Designing simulation architecture...</span>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* ── Contextual Suggestion Chips ── */}
      {contextualChips.length > 0 && (
        <div className="px-3 py-1.5 bg-white border-t border-indigo-50 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {contextualChips.map((chip, idx) => {
            const IconComp = chip.icon;
            return (
              <button
                key={idx}
                onClick={() => sendMessage(chip.prompt)}
                disabled={generating}
                className="px-2.5 py-1 rounded-full bg-[#F1F0FB] hover:bg-indigo-100/80 text-gray-700 hover:text-[#5742FF] text-[10.5px] font-bold border border-indigo-100/70 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              >
                <IconComp size={11} className="text-[#6366F1]" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Modern Floating Input Box & Footer ── */}
      <div className="p-3 bg-white border-t border-gray-100 shadow-xs">
        {/* Custom Inline Confirmation Banner */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="p-2.5 rounded-xl bg-rose-50/90 border border-rose-200/80 flex items-center justify-between gap-2 shadow-xs">
                <span className="text-[11px] font-bold text-rose-700">Clear chat history?</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={confirmClearChat}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-extrabold shadow-xs transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10.5px] font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.length > 0 && !showClearConfirm && (
          <div className="flex justify-between items-center mb-1.5 px-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={11} className="text-[#6366F1]" /> Simulation Co-Pilot
            </span>
            <button
              onClick={handleClearChat}
              className="text-[10.5px] font-semibold text-gray-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        )}

        <form
          onSubmit={handleFormSubmit}
          className="relative rounded-2xl border border-gray-200/80 bg-[#FAFAFC] focus-within:bg-white focus-within:border-[#6366F1] focus-within:ring-2 focus-within:ring-[#6366F1]/10 transition-all p-1.5 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI or describe a workflow..."
            disabled={generating}
            className="flex-1 px-2.5 py-1.5 text-[12px] font-medium text-gray-900 bg-transparent outline-none placeholder:text-gray-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || generating}
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white flex items-center justify-center shrink-0 shadow-sm hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Send prompt"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </form>
      </div>
    </div>
  );
}
