import React from "react";
import { motion } from "framer-motion";
import { X, Flame, GitBranch, Share2, Plus, ArrowRight, Info, Sparkles } from "lucide-react";
import { SIM_TYPE_REGISTRY, type StarterGraph } from "@/lib/simulation/simTypeRegistry";

export interface TemplateGalleryProps {
  simType: string;
  onLoadScenario: (scenario: StarterGraph) => void;
  onClose: () => void;
}

export default function TemplateGallery({ simType, onLoadScenario, onClose }: TemplateGalleryProps) {
  const config = SIM_TYPE_REGISTRY[simType as keyof typeof SIM_TYPE_REGISTRY] || SIM_TYPE_REGISTRY.human_queue;
  const scenarios = config.subScenarios.filter((s) => s.nodes.length > 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] relative flex flex-col max-h-[90vh] overflow-hidden border border-gray-100"
      >
        {/* Top accent gradient line */}
        <div className="absolute top-0 left-8 right-8 h-[3px] rounded-b-full bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#f97316] opacity-80" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full border border-gray-200 text-gray-400 flex items-center justify-center hover:bg-gray-50 hover:text-gray-700 transition-colors z-20 shadow-sm"
        >
          <X size={15} strokeWidth={2.5} />
        </button>

        <div className="p-8 overflow-y-auto flex-1">

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl mb-5 flex items-center justify-center bg-indigo-50 text-indigo-600 shadow-inner border border-indigo-100/50">
              <config.icon size={26} strokeWidth={2} />
            </div>
            <h2 className="text-[22px] font-bold text-[#111827] mb-2 -tracking-[0.025em]">
              Choose a Starting Template
            </h2>
            <p className="text-[13.5px] text-[#64748b] max-w-sm leading-relaxed font-medium">
              Pick a template to get started quickly or close this window to create your simulation from scratch.
            </p>
          </div>

          {/* Popular Templates */}
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-3 px-0.5">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-500 text-[10.5px] font-bold tracking-[0.12em] uppercase">
                <Flame size={11} strokeWidth={2.5} /> Popular Templates
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scenarios.map((scenario, idx) => {
                const ScenarioIcon = scenario.icon || config.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => onLoadScenario(scenario)}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-indigo-100 hover:-translate-y-0.5 transition-all duration-200 flex items-start gap-3.5 text-left group"
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-600 border border-indigo-100/50 group-hover:bg-indigo-100 group-hover:scale-105 transition-all duration-200">
                      <ScenarioIcon size={19} strokeWidth={2} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[13.5px] font-bold text-[#111827] leading-tight mb-1 tracking-tight">
                        {scenario.label}
                      </h3>
                      {scenario.description && (
                        <p className="text-[12px] text-[#64748b] leading-snug line-clamp-2 mb-2.5 font-medium">
                          {scenario.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100/60">
                          <GitBranch size={10} /> {scenario.nodes.length} Blocks
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
                          <Share2 size={10} /> {scenario.edges.length} Connections
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* OR Divider */}
          <div className="relative flex items-center justify-center my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dashed border-gray-200" />
            </div>
            <div className="relative bg-white px-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              OR
            </div>
          </div>

          {/* Blank Canvas */}
          <button
            onClick={onClose}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-gray-100 bg-[#fcfcfd] hover:bg-indigo-50/50 hover:border-indigo-100 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-100/50 group-hover:bg-indigo-100 group-hover:scale-105 transition-all">
                <Plus size={17} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h4 className="text-[13.5px] font-bold text-[#111827] leading-tight tracking-tight">Start with a Blank Canvas</h4>
                <p className="text-[12px] text-[#64748b] leading-tight mt-0.5 font-medium">Create a new simulation from scratch</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-indigo-400 transition-colors mr-1" />
          </button>

          {/* Info footer */}
          <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-100/60">
            <Info size={13} className="shrink-0 text-indigo-400" />
            <span className="text-[12px] text-indigo-600 font-medium">You can always change the template later from Project Settings.</span>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
