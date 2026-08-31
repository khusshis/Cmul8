"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ExternalLink, Clock, X, Edit2, Check, CheckCircle2, ArrowRight, FolderPlus, MoreVertical, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { getAllSimTypes } from "@/lib/simulation/simTypeRegistry";

interface Project {
  id: string;
  name: string;
  sim_type: string;
  updated_at: string;
  user_id: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  
  const simTypes = getAllSimTypes();
  const [newType, setNewType] = React.useState(simTypes[0]?.id || "human_queue");
  const [creating, setCreating] = React.useState(false);
  
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  React.useEffect(() => {
    loadData();
    
    // Listen for custom event from Navbar
    const handleOpenModal = () => setShowModal(true);
    window.addEventListener('open-new-sim-modal', handleOpenModal);
    return () => window.removeEventListener('open-new-sim-modal', handleOpenModal);
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    
    const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    
    // Artificial delay so the beautiful skeleton loader is actually visible
    await new Promise(r => setTimeout(r, 1200));
    
    setProjects(data || []);
    setLoading(false);
  }

  async function createProject() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("projects").insert({
      name: newName.trim(),
      sim_type: newType,
      user_id: user!.id,
      graph_json: JSON.stringify({ nodes: [], edges: [] }),
      updated_at: new Date().toISOString(),
    }).select().single();
    
    if (!error && data) {
      setShowModal(false);
      setNewName("");
      router.push(`/dashboard/project/${data.id}`);
    } else {
      console.error("Supabase Error:", error);
      alert("Failed to create project check console: " + (error?.message || JSON.stringify(error)));
    }
    setCreating(false);
  }

  async function deleteProject(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      alert("Failed to delete project: " + error.message);
      return;
    }
    setProjects((p) => p.filter((x) => x.id !== id));
    setDeleteId(null);
  }

  async function renameProject(id: string) {
    if (!renameValue.trim()) { 
      setRenamingId(null); 
      return; 
    }
    
    const { error } = await supabase.from("projects").update({ name: renameValue.trim() }).eq("id", id);
    if (error) {
      alert("Failed to rename project: " + error.message);
      return;
    }
    setProjects((p) => p.map((x) => x.id === id ? { ...x, name: renameValue.trim() } : x));
    setRenamingId(null);
  }

  const getType = (id: string) => simTypes.find((t) => t.id === id) || simTypes[0];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#F4F5FB" }}>
      {/* Decorative Wave Background */}
      <svg className="absolute bottom-0 right-0 w-[800px] h-auto pointer-events-none opacity-40 z-0" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M800 0C800 0 718.5 125.5 531 217.5C343.5 309.5 240 458 131.5 600H800V0Z" fill="url(#paint0_linear)"/>
        <path d="M800 137.5C800 137.5 727.5 253.5 540 345.5C352.5 437.5 249 586 140.5 728H800V137.5Z" fill="url(#paint1_linear)"/>
        <path d="M800 275C800 275 736.5 381.5 549 473.5C361.5 565.5 258 714 149.5 856H800V275Z" fill="url(#paint2_linear)"/>
        <defs>
          <linearGradient id="paint0_linear" x1="465.5" y1="300" x2="800" y2="300" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5742FF" stopOpacity="0.05"/>
            <stop offset="1" stopColor="#5742FF" stopOpacity="0.15"/>
          </linearGradient>
          <linearGradient id="paint1_linear" x1="470.25" y1="432.75" x2="800" y2="432.75" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8B5CF6" stopOpacity="0.04"/>
            <stop offset="1" stopColor="#8B5CF6" stopOpacity="0.12"/>
          </linearGradient>
          <linearGradient id="paint2_linear" x1="474.75" y1="565.5" x2="800" y2="565.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D946EF" stopOpacity="0.03"/>
            <stop offset="1" stopColor="#D946EF" stopOpacity="0.09"/>
          </linearGradient>
        </defs>
      </svg>

      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-32 pb-20 relative z-10">
        {/* Header with curvy underline */}
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.15em] mb-2" style={{ color: "#5742FF" }}>Workspace</p>
            <div className="relative inline-block mb-3">
              <h1 className="font-extrabold text-4xl tracking-tight text-[#111827]">My Simulations</h1>
              {/* Curvy SVG underline */}
              <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none">
                <path d="M0 4 C40 0, 60 8, 100 4 C140 0, 160 8, 200 4" stroke="url(#purple-grad)" strokeWidth="3" strokeLinecap="round" fill="none" />
                <defs>
                  <linearGradient id="purple-grad" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#5742FF" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <p className="text-[#6B7280] text-[15px]">Create, manage and run your simulation projects.</p>
          </div>
          {/* New Simulation button removed from here as it's now in the Navbar */}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/50 backdrop-blur-sm rounded-[24px] border border-gray-100 p-5 flex flex-col h-[260px] animate-pulse">
                <div className="w-[52px] h-[52px] rounded-[16px] bg-gray-200/50 mb-5" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-gray-200/60 rounded-full w-3/4" />
                  <div className="h-5 bg-gray-200/40 rounded-full w-1/3" />
                </div>
                <div className="h-3 bg-gray-100 rounded-full w-1/4 mt-5 mb-4" />
                <div className="flex gap-2.5 mt-auto">
                  <div className="h-9 bg-gray-200/50 rounded-[14px] flex-1" />
                  <div className="w-9 h-9 bg-gray-100 rounded-[12px]" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-[#F5F3FF] flex items-center justify-center">
              <FolderPlus size={32} className="text-[#5742FF]" />
            </div>
            <div>
              <h2 className="font-bold text-xl mb-2 text-[#111827]">No simulations yet</h2>
              <p className="text-sm text-gray-400">Create your first simulation to get started.</p>
            </div>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 py-2.5 px-6 rounded-2xl text-white font-semibold transition-all hover:shadow-[0_8px_24px_-6px_rgba(87,66,255,0.45)] hover:scale-[1.02] active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #5742FF, #4531E5)" }}>
              <Plus size={18} strokeWidth={2.5} /> Create First Simulation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7">
            {projects.map((proj, i) => {
              const type = getType(proj.sim_type);
              const isRenaming = renamingId === proj.id;
              
              return (
                <motion.div key={proj.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 20 }}>
                  <div className="bg-white rounded-[24px] shadow-[0_2px_16px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_-8px_rgba(87,66,255,0.15)] transition-all duration-300 overflow-hidden flex flex-col h-[340px] relative border border-gray-100/50">
                    
                    {/* Top Section with Wavy Background */}
                    <div className="h-[130px] relative flex items-center justify-center shrink-0">
                      {/* Gradient Background */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#F5F3FF] to-[#EBE9FF]" />
                      
                      {/* Wavy SVG overlay cutting into the background */}
                      <svg className="absolute bottom-0 left-0 w-full h-[50px] text-white" preserveAspectRatio="none" viewBox="0 0 1440 320" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                      </svg>
                      
                      {/* Dashboard 3D Icon */}
                      <div className="relative z-10 w-24 h-24 mb-4 transform hover:scale-105 transition-transform duration-300">
                        <img src={`/icons/${proj.sim_type}.png`} alt={type.label} className="w-full h-full object-contain mix-blend-multiply" />
                      </div>

                      {/* Top Right Options */}
                      <button className="absolute top-4 right-4 z-10 p-1.5 rounded-full text-gray-500 hover:bg-white/50 transition-colors">
                        <MoreVertical size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                    
                    {/* Content Section */}
                    <div className="p-5 flex flex-col flex-1 bg-white relative z-10">
                      
                      {/* Icon + Title */}
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${type.color}15` }}>
                          <img src={`/icons/${proj.sim_type}.png`} alt={type.label} className="w-6 h-6 object-contain mix-blend-multiply" />
                        </div>
                        <div className="flex-1 overflow-hidden min-w-0">
                          {isRenaming ? (
                            <div className="flex items-center gap-2 mb-1">
                              <input 
                                autoFocus
                                className="w-full px-2 py-1 text-sm border-2 rounded-lg focus:outline-none focus:border-[#5742FF] transition-colors bg-gray-50"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && renameProject(proj.id)}
                                onBlur={() => renameProject(proj.id)}
                              />
                              <button onClick={() => renameProject(proj.id)} className="text-green-500 hover:text-green-600 transition-colors shrink-0">
                                <Check size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between group/title mb-1">
                              <h3 className="font-extrabold text-[17px] text-[#111827] truncate tracking-[-0.02em]">{proj.name}</h3>
                              <button onClick={() => { setRenamingId(proj.id); setRenameValue(proj.name); }} className="opacity-0 group-hover/title:opacity-100 transition-all p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0">
                                <Edit2 size={13} />
                              </button>
                            </div>
                          )}
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded font-extrabold tracking-wider uppercase bg-[#F5F3FF] text-[#5742FF]">
                            {type.label}
                          </span>
                        </div>
                      </div>
                      
                      {/* Date */}
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-400 mt-2">
                        <Clock size={13} strokeWidth={2.5} />
                        {new Date(proj.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>

                      <div className="w-full h-px bg-gray-100 my-4" />
                      
                      {/* Actions */}
                      <div className="flex gap-3 mt-auto">
                        <Link href={`/dashboard/project/${proj.id}`} className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-[14px] text-[14px] font-bold text-[#5742FF] border border-[#5742FF] bg-[#F8F7FF] hover:bg-[#F5F3FF] transition-all duration-300">
                          <ExternalLink size={16} strokeWidth={2.5} /> Open
                        </Link>
                        <button onClick={() => setDeleteId(proj.id)} className="flex items-center justify-center w-[46px] h-[46px] rounded-[14px] border border-gray-200 bg-white text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-300 shrink-0">
                          <Trash2 size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Create New Simulation Card */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: projects.length * 0.06, type: "spring", stiffness: 260, damping: 20 }}>
              <div className="w-full h-[340px] rounded-[24px] border-2 border-dashed border-[#E5E0FF] bg-white flex flex-col items-center justify-center p-6 relative">
                <div className="w-16 h-16 rounded-full border border-[#E5E0FF] bg-white text-[#5742FF] flex items-center justify-center mb-6 shadow-sm">
                  <Plus size={24} strokeWidth={2.5} />
                </div>
                <h3 className="font-extrabold text-[18px] text-[#111827] mb-2">Create New Simulation</h3>
                <p className="text-[13px] text-gray-500 text-center mb-6 max-w-[200px] leading-relaxed">
                  Start building your next simulation project.
                </p>
                <button onClick={() => setShowModal(true)} className="px-5 py-2.5 rounded-full text-white text-[13px] font-bold shadow-md hover:shadow-lg transition-shadow flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #5742FF, #4531E5)" }}>
                  <Plus size={16} strokeWidth={2.5} />
                  New Simulation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white w-full max-w-xl rounded-[24px] shadow-2xl relative flex flex-col max-h-[90vh] md:max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              
              {/* Close Button */}
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 md:top-5 md:right-5 p-1.5 rounded-xl bg-indigo-50 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors z-20">
                <X size={18} strokeWidth={2.5} />
              </button>

              <div className="p-5 md:p-7 pb-0 md:pb-0 overflow-y-auto custom-scrollbar flex-1">
                {/* Header */}
                <div className="flex items-center gap-1 mb-5 md:mb-6 -ml-2">
                  <img src="/logo-transparent.png" alt="Logo" className="w-14 h-14 md:w-16 md:h-16 object-contain scale-[1.35]" />
                  <div className="-ml-1 md:-ml-2">
                    <h2 className="font-bold text-xl md:text-2xl text-[#111827] tracking-tight">New Simulation</h2>
                    <p className="text-[#6B7280] text-[13px] md:text-[14px]">Create a new simulation project</p>
                  </div>
                </div>

                {/* Form Content */}
                <div className="space-y-6 mb-6">
                  <div>
                    <label className="block text-[14px] font-bold text-[#111827] mb-2">Project Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400">
                        <FolderPlus size={16} />
                      </div>
                      <input 
                        autoFocus 
                        className="w-full pl-12 pr-4 py-3 border-2 rounded-full focus:outline-none focus:ring-0 focus:border-[#5742FF] text-[#111827] placeholder-gray-400 font-medium transition-colors border-[#E5E0FF] text-sm" 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Bank Teller Optimization" 
                        onKeyDown={(e) => e.key === "Enter" && newName.trim() && createProject()} 
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-3">
                      <label className="block text-[14px] font-bold text-[#111827] mb-0.5">Simulation Domain</label>
                      <p className="text-[13px] text-[#6B7280]">Select the domain that best matches your simulation.</p>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { id: "human_queue", label: "HUMAN QUEUE", sub: "People, lines, service systems" },
                        { id: "vehicle", label: "VEHICLE", sub: "Traffic, vehicles, transport systems" },
                        { id: "liquid", label: "LIQUID / MATERIAL", sub: "Flow of liquids or materials" },
                        { id: "manufacturing", label: "MANUFACTURING", sub: "Production lines, machines, operations" },
                        { id: "logistics", label: "LOGISTICS", sub: "Warehousing, supply chain, distribution" },
                        { id: "network_signal", label: "NETWORK / SIGNAL", sub: "Networks, signals, communication" }
                      ].map((type) => {
                        const isSelected = newType === type.id;
                        return (
                          <button 
                            key={type.id} 
                            onClick={() => setNewType(type.id)}
                            className={`relative flex flex-col items-center justify-center p-4 rounded-[16px] transition-all border-2 text-center h-full min-h-[120px]
                              ${isSelected ? "border-[#5742FF] bg-[#F8F7FF]" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                          >
                            {isSelected && (
                              <div className="absolute top-2 right-2 text-[#5742FF] bg-white rounded-full">
                                <CheckCircle2 size={16} fill="#5742FF" className="text-white" />
                              </div>
                            )}
                            <img src={`/icons/${type.id}.png`} alt={type.label} className="w-14 h-14 md:w-16 md:h-16 object-contain mb-2 mix-blend-multiply brightness-105 contrast-110" />
                            <div className={`text-[12px] font-bold tracking-wide mb-1 ${isSelected ? "text-[#111827]" : "text-[#374151]"}`}>
                              {type.label}
                            </div>
                            <div className="text-[11px] text-[#6B7280] leading-tight px-1">
                              {type.sub}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Attached Button */}
              <button 
                onClick={createProject} 
                disabled={creating || !newName.trim()} 
                className="w-full flex items-center justify-center py-4 rounded-t-none rounded-b-[24px] text-white font-semibold transition-all disabled:opacity-80 disabled:cursor-not-allowed bg-gradient-to-r from-[#5742FF] to-[#4531E5] hover:brightness-110 shrink-0"
              >
                <span className="text-[16px] tracking-wide flex items-center gap-2">
                  {creating && <Loader2 size={18} className="animate-spin text-white/90" />}
                  {creating ? "Creating Project..." : "Create Project"}
                </span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="card-surface p-6 rounded-2xl w-full max-w-sm space-y-4 text-center border" style={{ borderColor: "var(--color-border)" }}>
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: "var(--color-error-light, #fee2e2)", color: "var(--color-error)" }}>
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>Delete Simulation</h3>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Are you sure you want to delete this simulation? This action cannot be undone.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-full text-sm font-medium border" style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}>Cancel</button>
                <button onClick={() => deleteProject(deleteId)} className="flex-1 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: "var(--color-error)" }}>Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
