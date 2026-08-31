import React from "react";
import { motion } from "framer-motion";
import { X, Flame, GitCommit, ArrowRight, ArrowRightCircle, MoveRight, GitBranch, Share2, Plus, Info } from "lucide-react";
import { SIM_TYPE_REGISTRY, type StarterGraph } from "@/lib/simulation/simTypeRegistry";

export interface TemplateGalleryProps {
  simType: string;
  onLoadScenario: (scenario: StarterGraph) => void;
  onClose: () => void;
}

export default function TemplateGallery({ simType, onLoadScenario, onClose }: TemplateGalleryProps) {
  const config = SIM_TYPE_REGISTRY[simType as keyof typeof SIM_TYPE_REGISTRY] || SIM_TYPE_REGISTRY.human_queue;
  // Filter out empty starter graphs
  const scenarios = config.subScenarios.filter((s) => s.nodes.length > 0);
  
  // Use config color or a default purple
  const primaryColor = config.theme?.primaryColor || "#5742FF";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-4xl bg-white rounded-[24px] shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50 hover:text-gray-700 transition-colors z-20 shadow-sm"
        >
          <X size={16} strokeWidth={2.5} />
        </button>

        <div className="p-8 md:p-10 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Header Section */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 rounded-full mb-4 flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
              <img src={`/icons/${simType}.png`} alt="Template Icon" className="w-8 h-8 object-contain mix-blend-multiply brightness-105 contrast-110" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#111827] mb-2 tracking-tight">Choose a Starting Template</h2>
            <p className="text-[#6B7280] text-[14.5px] max-w-md leading-relaxed">
              Pick a template to get started quickly or close this window to create your simulation from scratch.
            </p>
          </div>

          {/* Popular Templates Section */}
          <div className="mb-8">
            <div className="flex items-center gap-1.5 mb-4 px-1" style={{ color: primaryColor }}>
              <Flame size={14} strokeWidth={3} />
              <span className="text-[11px] font-bold tracking-widest uppercase">Popular Templates</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {scenarios.map((scenario, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-gray-300 transition-all duration-300 flex flex-col group">
                  <div className="flex gap-4 mb-5">
                    {/* Icon Container */}
                    <div className="w-[84px] h-[84px] rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}10` }}>
                      <img src={`/icons/${simType}.png`} alt={scenario.label} className="w-12 h-12 object-contain mix-blend-multiply transition-transform group-hover:scale-110 duration-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-[#111827] mb-1 truncate">{scenario.label}</h3>
                      <p className="text-sm text-[#6B7280] leading-snug line-clamp-2 mb-3">
                        {scenario.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                          <GitBranch size={12} /> {scenario.nodes.length} Blocks
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-600">
                          <Share2 size={12} /> {scenario.edges.length} Connections
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onLoadScenario(scenario)}
                    className="w-full mt-auto py-2.5 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-transform hover:brightness-110 active:scale-[0.98]"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}E6)` }}
                  >
                    Use Template <MoveRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* OR Divider */}
          <div className="relative flex items-center justify-center my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dashed border-gray-200"></div>
            </div>
            <div className="relative bg-white px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
              OR
            </div>
          </div>

          {/* Blank Canvas Option */}
          <button
            onClick={onClose}
            className="w-full flex items-center justify-between p-4 rounded-[20px] border-2 border-dashed border-[#E5E0FF] bg-white hover:bg-[#F8F7FF] transition-colors group mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#F5F3FF] text-[#5742FF] group-hover:bg-[#5742FF] group-hover:text-white transition-colors shadow-sm">
                <Plus size={20} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h4 className="text-[15px] font-bold text-[#111827] mb-0.5">Start with a Blank Canvas</h4>
                <p className="text-[13px] text-gray-500">Create a new simulation from scratch</p>
              </div>
            </div>
            <ArrowRight className="text-gray-300 group-hover:text-[#5742FF] transition-colors mr-2" />
          </button>

          {/* Info footer */}
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-[#F8F7FF] text-[#5742FF]">
            <Info size={16} className="shrink-0" />
            <span className="text-[12px] font-medium">You can always change the template later from Project Settings.</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
