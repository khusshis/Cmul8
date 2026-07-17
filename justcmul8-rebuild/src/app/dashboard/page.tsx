"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ExternalLink, Clock, X, Edit2, Check, CheckCircle2, ArrowRight, FolderPlus } from "lucide-react";
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
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    
    const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
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
    <div className="min-h-screen relative" style={{ background: "var(--color-bg)" }}>
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>Workspace</p>
            <h1 className="font-bold text-3xl tracking-tight" style={{ color: "var(--color-text-primary)" }}>My Simulations</h1>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 py-2 px-4 rounded-full text-white font-medium transition-colors hover:opacity-90" style={{ backgroundColor: "var(--color-info)" }}>
            <Plus size={18} /> New Simulation
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>Loading simulations...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
            <div className="text-6xl opacity-20">🧪</div>
            <div>
              <h2 className="font-bold text-xl mb-2" style={{ color: "var(--color-text-primary)" }}>No simulations yet</h2>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Create your first simulation to get started.</p>
            </div>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 py-2 px-6 rounded-full text-white font-medium transition-colors hover:opacity-90 mt-4" style={{ backgroundColor: "var(--color-info)" }}>
              <Plus size={18} /> Create First Simulation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((proj, i) => {
              const type = getType(proj.sim_type);
              const isRenaming = renamingId === proj.id;
              
              return (
                <motion.div key={proj.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="card-surface p-5 space-y-4 relative group flex flex-col h-full rounded-2xl border" style={{ borderColor: "var(--color-border)" }}>
                    {/* Top color accent line */}
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: type.color }} />
                    
                    <div className="text-3xl mt-1">{type.icon}</div>
                    
                    <div className="flex-1">
                      {isRenaming ? (
                        <div className="flex items-center gap-2 mb-2">
                          <input 
                            autoFocus
                            className="w-full px-2 py-1 text-sm border rounded focus:outline-none"
                            style={{ borderColor: "var(--color-border)", background: "var(--color-bg)", color: "var(--color-text-primary)" }}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && renameProject(proj.id)}
                            onBlur={() => renameProject(proj.id)}
                          />
                          <button onClick={() => renameProject(proj.id)} className="text-green-500 hover:text-green-600 transition-colors">
                            <Check size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group/title">
                          <h3 className="font-semibold text-sm truncate" style={{ color: "var(--color-text-primary)" }}>{proj.name}</h3>
                          <button onClick={() => { setRenamingId(proj.id); setRenameValue(proj.name); }} className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1" style={{ color: "var(--color-text-secondary)" }}>
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                      
                      <span className="inline-block text-xs mt-1 px-2 py-0.5 rounded-md font-medium" style={{ background: `${type.color}15`, color: type.color }}>
                        {type.label}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                      <Clock size={12} />
                      {new Date(proj.updated_at).toLocaleDateString()}
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Link href={`/dashboard/project/${proj.id}`} className="flex-1 flex justify-center items-center gap-1 py-1.5 rounded-md text-xs font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--color-info)" }}>
                        <ExternalLink size={12} /> Open
                      </Link>
                      <button onClick={() => setDeleteId(proj.id)} className="flex items-center justify-center p-1.5 rounded-md transition-colors" style={{ backgroundColor: "var(--color-error)", color: "white" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
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
              className="bg-white p-5 md:p-6 w-full max-w-xl rounded-[24px] shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
              
              {/* Close Button */}
              <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 p-1.5 rounded-xl bg-indigo-50 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
                <X size={18} strokeWidth={2.5} />
              </button>

              {/* Header */}
              <div className="flex items-center gap-1 mb-6 -ml-2">
                <img src="/logo-transparent.png" alt="Logo" className="w-16 h-16 md:w-20 md:h-20 object-contain scale-[1.35]" />
                <div className="-ml-1 md:-ml-3">
                  <h2 className="font-bold text-2xl text-[#111827] tracking-tight">New Simulation</h2>
                  <p className="text-[#6B7280] text-[14px]">Create a new simulation project</p>
                </div>
              </div>

              {/* Form Content */}
              <div className="space-y-5">
                <div>
                  <label className="block text-[14px] font-bold text-[#111827] mb-1.5">Project Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400">
                      <FolderPlus size={16} />
                    </div>
                    <input 
                      autoFocus 
                      className="w-full pl-12 pr-4 py-3 border-2 rounded-full focus:outline-none focus:ring-0 focus:border-[#5742FF] text-[#111827] placeholder-gray-400 font-medium transition-colors border-gray-200 text-sm" 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Bank Teller Optimization" 
                      onKeyDown={(e) => e.key === "Enter" && newName.trim() && createProject()} 
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2.5">
                    <label className="block text-[14px] font-bold text-[#111827] mb-0.5">Simulation Domain</label>
                    <p className="text-[13px] text-[#6B7280]">Select the domain that best matches your simulation.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                            ${isSelected ? "border-[#5742FF] bg-[#F5F3FF]" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                        >
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 text-[#5742FF] bg-white rounded-full">
                              <CheckCircle2 size={16} fill="#5742FF" className="text-white" />
                            </div>
                          )}
                          {/* Removing drop-shadow-sm and applying mix-blend-multiply to remove the white background */}
                          <img src={`/icons/${type.id}.png`} alt={type.label} className="w-16 h-16 object-contain mb-2 mix-blend-multiply brightness-105 contrast-110" />
                          <div className={`text-[12px] font-bold tracking-wide mb-0.5 ${isSelected ? "text-[#111827]" : "text-[#374151]"}`}>
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

                <button 
                  onClick={createProject} 
                  disabled={creating || !newName.trim()} 
                  className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-full text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#5742FF] to-[#4531E5] hover:shadow-[0_8px_20px_-6px_rgba(87,66,255,0.4)]"
                >
                  <span className="text-[15px]">{creating ? "Creating..." : "Create Project"}</span>
                </button>
              </div>
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
