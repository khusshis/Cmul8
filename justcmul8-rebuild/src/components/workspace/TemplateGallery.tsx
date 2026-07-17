import React from "react";
import { SIM_TYPE_REGISTRY, type StarterGraph } from "@/lib/simulation/simTypeRegistry";

export interface TemplateGalleryProps {
  simType: string;
  onLoadScenario: (scenario: StarterGraph) => void;
  onClose: () => void;
}

export default function TemplateGallery({ simType, onLoadScenario, onClose }: TemplateGalleryProps) {
  const config = SIM_TYPE_REGISTRY[simType as keyof typeof SIM_TYPE_REGISTRY] || SIM_TYPE_REGISTRY.human_queue;
  // Filter out the empty "Start from scratch" one which is handled by just dismissing/not picking a template usually,
  // or we can render it. The instructions say it filters out nodes.length === 0.
  const scenarios = config.subScenarios.filter((s) => s.nodes.length > 0);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg-surface-sunken/80 backdrop-blur-sm">
      <div className="max-w-4xl w-full mx-auto p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">Simulation Templates</h2>
          <p className="text-text-secondary">Select a starter template or close to start from a blank canvas.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario, idx) => (
            <button
              key={idx}
              onClick={() => onLoadScenario(scenario)}
              className="text-left bg-surface rounded-xl p-6 border border-border hover:border-color-info hover:shadow-lg transition-all"
            >
              <h3 className="text-lg font-semibold text-text-primary mb-2">{scenario.label}</h3>
              <p className="text-sm text-text-secondary mb-4 min-h-[40px]">{scenario.description}</p>
              
              <div className="flex items-center text-xs text-text-muted font-mono">
                <span className="mr-3">{scenario.nodes.length} Nodes</span>
                <span>{scenario.edges.length} Edges</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
