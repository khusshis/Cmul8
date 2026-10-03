"use client";
import React from "react";
import Link from "next/link";
import NodeCanvas from "@/components/workspace/NodeCanvas";
import { LogIn } from "lucide-react";

export default function ShareViewer({ name, simType, graph, loginUrl }: { name: string; simType: string; graph: { nodes: any[]; edges: any[] }; loginUrl: string }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg-surface-sunken">
      <div className="flex-shrink-0 h-14 flex items-center justify-between px-5 bg-white border-b border-gray-100">
        <div className="font-bold text-[#111827] text-[14px]">{name} <span className="text-gray-400 font-medium">(view only)</span></div>
        <Link href={loginUrl} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#5742FF] border border-[#8d80ff] text-white text-[12.5px] font-bold hover:bg-[#4531E5] transition-colors">
          <LogIn size={14} /> Sign in to collaborate
        </Link>
      </div>
      <div className="flex-1 relative">
        <NodeCanvas
          nodes={graph.nodes || []}
          edges={graph.edges || []}
          simType={simType}
          onNodesChange={() => {}}
          onEdgesChange={() => {}}
          selectedNodeId={null}
          onSelectNode={() => {}}
          simState="idle"
          readOnly
        />
      </div>
    </div>
  );
}
