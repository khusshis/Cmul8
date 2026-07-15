"use client";
import React from "react";
import { Send, Bot, User, Loader } from "lucide-react";

interface Message { role: "user" | "ai"; text: string; }
interface AIChatPanelProps {
  simType: string;
  currentGraph: { nodes: any[]; edges: any[] };
  onGraphGenerated: (nodes: any[], edges: any[]) => void;
}

const WELCOME = "Hello! I'm your AI simulation assistant powered by Gemini. Describe the system you want to simulate and I'll build the graph for you.\n\nExample: \"Create a bank with 3 tellers and a queue. Customers arrive every 2 minutes.\"";

export default function AIChatPanel({ simType, currentGraph, onGraphGenerated }: AIChatPanelProps) {
  const [messages, setMessages] = React.useState<Message[]>([{ role: "ai", text: WELCOME }]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMsg, simType, currentGraph }),
      });
      const data = await res.json();
      if (data.graph) {
        onGraphGenerated(data.graph.nodes, data.graph.edges);
        setMessages((m) => [...m, { role: "ai", text: data.message || "Graph generated! Check the canvas." }]);
      } else {
        setMessages((m) => [...m, { role: "ai", text: data.message || data.error || "Sorry, I couldn't process that." }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Connection error. Please try again." }]);
    }
    setLoading(false);
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-secondary)" }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor: "rgba(0,242,255,0.1)" }}>
        <Bot size={14} style={{ color: "var(--neon-cyan)" }} />
        <span className="text-xs tracking-widest" style={{ fontFamily: "var(--font-mono)", color: "var(--neon-cyan)" }}>AI ASSISTANT</span>
        <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(0,242,255,0.1)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.6rem" }}>GEMINI</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: msg.role === "user" ? "rgba(0,242,255,0.15)" : "rgba(112,0,255,0.15)" }}>
              {msg.role === "user" ? <User size={12} style={{ color: "var(--neon-cyan)" }} /> : <Bot size={12} style={{ color: "#a78bfa" }} />}
            </div>
            <div className="max-w-[85%] px-3 py-2 rounded text-xs leading-relaxed whitespace-pre-wrap"
              style={{
                background: msg.role === "user" ? "rgba(0,242,255,0.08)" : "rgba(112,0,255,0.1)",
                border: `1px solid ${msg.role === "user" ? "rgba(0,242,255,0.2)" : "rgba(112,0,255,0.2)"}`,
                color: msg.role === "user" ? "var(--neon-cyan)" : "#e2d9f3",
                fontFamily: "var(--font-mono)",
              }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(112,0,255,0.15)" }}>
              <Bot size={12} style={{ color: "#a78bfa" }} />
            </div>
            <div className="px-3 py-2 rounded flex items-center gap-1.5"
              style={{ background: "rgba(112,0,255,0.1)", border: "1px solid rgba(112,0,255,0.2)" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--neon-cyan)", animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t" style={{ borderColor: "rgba(0,242,255,0.1)" }}>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              id="ai-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Describe your simulation..."
              rows={2}
              className="input-cyber resize-none text-xs"
              style={{ fontSize: "0.75rem", padding: "8px 10px" }}
            />
          </div>
          <button id="ai-send-btn" onClick={sendMessage} disabled={loading || !input.trim()}
            className="flex-shrink-0 self-end btn-cyber-primary" style={{ padding: "8px 12px" }}>
            {loading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-xs mt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "0.6rem" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
