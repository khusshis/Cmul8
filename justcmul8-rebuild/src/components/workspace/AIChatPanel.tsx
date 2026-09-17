"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Send,
  Sparkles,
  Zap,
  Bot,
  User,
  RotateCcw,
  CheckCircle2,
  Layers,
  ArrowRight,
  Coffee,
  HeartPulse,
  Package,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";

export interface AIChatPanelProps {
  project: { id: string; name: string; sim_type: string };
  nodes: any[];
  edges: any[];
  onApplyChanges: (nodes: any[], edges: any[]) => void;
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

// ─── Quick Start Starter Prompts ────────────────────────────────
const STARTER_PROMPTS = [
  {
    icon: Coffee,
    title: "Coffee Shop Drive-Thru",
    prompt:
      "Create a coffee shop simulation with an order station, 2 barista service counters, and a customer pickup area with burst morning arrivals.",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    icon: HeartPulse,
    title: "Hospital Emergency Room",
    prompt:
      "Design an emergency triage with a standard queue, a VIP fast-track priority lane, 3 doctors, and a recovery sink.",
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    icon: Package,
    title: "E-Commerce Fulfillment",
    prompt:
      "Build a warehouse packing workflow: order intake, sorting station, packaging queue, quality inspection, and dispatch routing.",
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
  {
    icon: Building2,
    title: "Bank Customer Desks",
    prompt:
      "Create a bank lobby with a single waiting line, 4 teller desks, and customer patience timeout where people leave after 10 seconds.",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
];

export default function AIChatPanel({ project, nodes, edges, onApplyChanges }: AIChatPanelProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, generating]);

  async function sendMessage(textToSend: string) {
    if (!textToSend.trim() || generating) return;

    const userMessage = {
      project_id: project.id,
      role: "user",
      content: textToSend,
    };

    // Optimistic UI update
    const tempId = Date.now().toString();
    setMessages((prev) => [...prev, { ...userMessage, id: tempId }]);
    setInput("");
    setGenerating(true);

    try {
      // Save user message to DB
      await supabase.from("chat_history").insert(userMessage);

      // Call generation API
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          simType: project.sim_type,
          currentNodesCount: nodes.length,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate simulation");
      const graphData = await res.json();

      const nodeCount = graphData.nodes?.length || 0;
      const edgeCount = graphData.edges?.length || 0;

      const assistantMessage = {
        project_id: project.id,
        role: "assistant",
        content: `I've designed and generated your simulation flow with ${nodeCount} interconnected stations.`,
        metadata: graphData,
      };

      // Save AI message to DB
      const { data } = await supabase.from("chat_history").insert(assistantMessage).select().single();
      setMessages((prev) => [...prev, data || { ...assistantMessage, id: Date.now().toString() }]);

      // Apply graph directly to canvas
      if (graphData.nodes && graphData.edges) {
        onApplyChanges(graphData.nodes, graphData.edges);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "I couldn't complete the simulation model. Please verify your GEMINI_API_KEY or try with a simpler description.",
        },
      ]);
    } finally {
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
    <div className="w-full h-full flex flex-col bg-[#FAF9FF] text-[#111827] overflow-hidden">
      {/* ── Chat Messages Scroll Container ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 ? (
          /* ── Hero Empty State with Interactive Starter Cards ── */
          <div className="py-4 space-y-5 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-500/20">
                <Sparkles size={22} />
              </div>
              <h3 className="text-[15px] font-black text-gray-900 tracking-tight">AI Simulation Architect</h3>
              <p className="text-[12px] text-gray-500 max-w-[260px] mx-auto leading-relaxed">
                Describe any real-world workflow or business system. I will design the blocks and auto-connect the entire network.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block px-1">
                Quick Start Templates
              </span>

              <div className="space-y-2">
                {STARTER_PROMPTS.map((item, idx) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendMessage(item.prompt)}
                      disabled={generating}
                      className="w-full p-2.5 rounded-xl bg-white border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 text-left transition-all group flex items-start gap-2.5 shadow-xs"
                    >
                      <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${item.color}`}>
                        <IconComp size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-bold text-gray-900 group-hover:text-[#6366F1] flex items-center justify-between">
                          <span>{item.title}</span>
                          <ArrowRight
                            size={12}
                            className="text-gray-300 group-hover:text-[#6366F1] group-hover:translate-x-0.5 transition-all"
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{item.prompt}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ── Message Thread ── */
          <div className="space-y-3.5 pb-2">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-end gap-1.5 max-w-[90%]">
                    {!isUser && <CustomAIBotAvatar className="w-6 h-6 mb-1" />}

                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed shadow-xs ${
                        isUser
                          ? "bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white rounded-br-xs font-medium"
                          : "bg-white border border-gray-100 text-gray-800 rounded-bl-xs shadow-xs"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>

                  {/* Metadata Graph Info Card */}
                  {m.metadata?.nodes && (
                    <div className="mt-2 ml-7 p-2.5 rounded-xl bg-white border border-indigo-100/80 shadow-xs max-w-[85%] space-y-2">
                      <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[11.5px]">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        Canvas Updated
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 font-semibold">
                        <span className="flex items-center gap-1">
                          <Layers size={12} className="text-[#6366F1]" /> {m.metadata.nodes.length} Blocks
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap size={12} className="text-amber-500" /> {m.metadata.edges?.length || 0} Links
                        </span>
                      </div>
                      <button
                        onClick={() => onApplyChanges(m.metadata.nodes, m.metadata.edges)}
                        className="w-full py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-[#6366F1] rounded-lg transition-colors"
                      >
                        Re-apply to Canvas
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* AI Generating Indicator */}
            {generating && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2">
                <CustomAIBotAvatar className="w-6 h-6 mt-0.5" />
                <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-xs bg-white border border-indigo-100 text-[12px] font-semibold text-gray-600 flex items-center gap-2 shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6366F1]" />
                  <span>Wiring simulation network...</span>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

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
                <span className="text-[11.5px] font-bold text-rose-700">Clear chat history?</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={confirmClearChat}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold shadow-xs transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.length > 0 && !showClearConfirm && (
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={11} className="text-[#6366F1]" /> Copilot Active
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
            placeholder="Describe your process (e.g. 3 tellers with queue)..."
            disabled={generating}
            className="flex-1 px-2.5 py-1.5 text-[12.5px] font-medium text-gray-900 bg-transparent outline-none placeholder:text-gray-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || generating}
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white flex items-center justify-center shrink-0 shadow-sm hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Send prompt"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
      </div>
    </div>
  );
}
