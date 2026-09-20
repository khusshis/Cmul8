"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Code2,
  Terminal,
  FileCode2,
  Cpu,
  Layers,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { SimGraph, SimResult } from "@/lib/simulation/types";
import { generateSimPyScript } from "@/lib/simulation/codeGenerator";
import { downloadJupyterNotebook } from "@/lib/simulation/jupyterExport";

interface CodeInspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  graph: SimGraph;
  projectName?: string;
  durationSeconds?: number;
  tickIntervalSeconds?: number;
  result?: SimResult | null;
}

export function CodeInspectorPanel({
  isOpen,
  onClose,
  graph,
  projectName = "Simulation System",
  durationSeconds = 60,
  tickIntervalSeconds = 1,
  result = null,
}: CodeInspectorPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate python code on the fly based on current graph state
  const { python } = generateSimPyScript(
    graph,
    durationSeconds,
    tickIntervalSeconds
  );

  const lineCount = python.split("\n").length;
  const charCount = python.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(python);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code to clipboard", err);
    }
  };

  const handleDownloadNotebook = () => {
    downloadJupyterNotebook(python, projectName, result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] flex flex-col rounded-2xl bg-[#0c0d12] border border-white/10 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#12141c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Python / SimPy Code Inspector
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Executable discrete-event simulation model mirroring your canvas architecture
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10"
              }`}
              title="Copy raw Python code"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadNotebook}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/30 transition-all shadow-sm"
              title="Export as standalone Jupyter Notebook (.ipynb)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .ipynb</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-2"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-[#0f1017] border-b border-white/5 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>{graph.nodes.length} Nodes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>{graph.edges.length} Connections</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>{durationSeconds}s Duration</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>{lineCount} lines</span>
            <span>•</span>
            <span>{(charCount / 1024).toFixed(1)} KB</span>
            <span>•</span>
            <span className="text-slate-400">SimPy v4.x Compatible</span>
          </div>
        </div>

        {/* Code View Area */}
        <div className="flex-1 overflow-auto bg-[#0a0b0e] p-4 font-mono text-[13px] leading-relaxed custom-scrollbar">
          <SyntaxHighlighter
            language="python"
            style={oneDark}
            showLineNumbers
            customStyle={{
              background: "transparent",
              padding: "0",
              margin: "0",
              fontSize: "12.5px",
              lineHeight: "1.6",
            }}
            lineNumberStyle={{
              minWidth: "3.2em",
              paddingRight: "1.2em",
              color: "#4b5563",
              userSelect: "none",
            }}
          >
            {python}
          </SyntaxHighlighter>
        </div>

        {/* Bottom Quick Help Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#12141c] text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <FileCode2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Run locally:</strong> Install SimPy via{" "}
              <code className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-emerald-300 font-mono text-[11px]">
                pip install simpy
              </code>{" "}
              and run in any Python 3.8+ environment or Jupyter Notebook.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
