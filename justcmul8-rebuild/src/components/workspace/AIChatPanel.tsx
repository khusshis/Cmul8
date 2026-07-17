import React, { useState, useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface AIChatPanelProps {
  project: { id: string; name: string; sim_type: string };
  nodes: any[];
  edges: any[];
  onApplyChanges: (nodes: any[], edges: any[]) => void;
}

export default function AIChatPanel({ project, nodes, edges, onApplyChanges }: AIChatPanelProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || generating) return;

    const userMessage = {
      project_id: project.id,
      role: "user",
      content: input,
    };
    
    // Optimistic UI
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, { ...userMessage, id: tempId }]);
    setInput("");
    setGenerating(true);

    try {
      // Save user message
      await supabase.from("chat_history").insert(userMessage);

      // Call API
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: input, 
          simType: project.sim_type, 
          currentNodesCount: nodes.length 
        }),
      });

      if (!res.ok) throw new Error("Failed to generate");
      const graphData = await res.json();
      
      const assistantMessage = {
        project_id: project.id,
        role: "assistant",
        content: "I have generated a new simulation graph for you based on your request.",
        metadata: graphData
      };
      
      // Save AI message to DB
      const { data } = await supabase.from("chat_history").insert(assistantMessage).select().single();
      setMessages(prev => [...prev, data || { ...assistantMessage, id: Date.now().toString() }]);

      // Apply graph
      if (graphData.nodes && graphData.edges) {
        onApplyChanges(graphData.nodes, graphData.edges);
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Sorry, I encountered an error while trying to process your request. Please check if your GEMINI_API_KEY is configured."
      }]);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="w-80 h-full border-l border-border bg-surface flex flex-col p-4 items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="w-80 h-full border-l border-border bg-surface flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">AI Assistant</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="text-xs text-text-secondary text-center">No messages yet. Ask me to build a simulation!</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`text-sm px-3 py-2 rounded-lg max-w-[85%] ${
              m.role === "user" ? "bg-color-info text-white" : "bg-bg-surface-sunken text-text-primary"
            }`}>
              {m.content}
            </div>
            {m.metadata?.nodes && (
              <div className="text-xs mt-1 text-text-secondary italic">
                Graph generated: {m.metadata.nodes.length} nodes
              </div>
            )}
          </div>
        ))}
        {generating && (
          <div className="flex items-start">
            <div className="text-sm px-3 py-2 rounded-lg bg-bg-surface-sunken text-text-primary flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your process..."
          disabled={generating}
          className="flex-1 bg-bg-surface-sunken border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-color-info disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || generating}
          className="bg-color-info hover:bg-color-info-hover text-white p-2 rounded-md transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
