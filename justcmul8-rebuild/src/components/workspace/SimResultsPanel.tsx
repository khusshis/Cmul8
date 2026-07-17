import React from "react";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";

export interface SimResultsPanelProps {
  result: SimResult;
  simType: SimTypeId;
  onClose: () => void;
}

export default function SimResultsPanel(props: SimResultsPanelProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-64 border-t border-border bg-surface flex flex-col p-4 z-50">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-text-primary">Results Dashboard</h2>
        <button onClick={props.onClose} className="text-xs text-text-secondary hover:text-text-primary">Close</button>
      </div>
      <p className="text-xs text-text-secondary">Results Dashboard — coming soon</p>
    </div>
  );
}
