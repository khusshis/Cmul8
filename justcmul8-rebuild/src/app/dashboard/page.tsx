"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ExternalLink, Clock, X, Edit2, Check, CheckCircle2, ArrowRight, FolderPlus, MoreVertical, Loader2, Calendar, Users, Car, Droplet, Factory, Package, Radio, Box, BarChart3, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { getAllSimTypes } from "@/lib/simulation/simTypeRegistry";
import { toast } from "@/components/ui/Toast";

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
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadData();
    
    // Listen for custom event from Navbar
    const handleOpenModal = () => setShowModal(true);
    window.addEventListener('open-new-sim-modal', handleOpenModal);

    // Close options dropdown on outside click
    const handleOutsideClick = () => setMenuOpenId(null);
    window.addEventListener('click', handleOutsideClick);

    return () => {
      window.removeEventListener('open-new-sim-modal', handleOpenModal);
      window.removeEventListener('click', handleOutsideClick);
    };
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
      toast.success("Simulation created successfully!", "Project Ready");
      router.push(`/dashboard/project/${data.id}`);
    } else {
      console.error("Supabase Error:", error);
      toast.error(error?.message || "Failed to create project", "Creation Error");
    }
    setCreating(false);
  }

  async function deleteProject(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete project: " + error.message);
      return;
    }
    setProjects((p) => p.filter((x) => x.id !== id));
    setDeleteId(null);
    toast.success("Simulation deleted successfully");
  }

  async function renameProject(id: string) {
    if (!renameValue.trim()) { 
      setRenamingId(null); 
      return; 
    }
    
    const { error } = await supabase.from("projects").update({ name: renameValue.trim() }).eq("id", id);
    if (error) {
      toast.error("Failed to rename project: " + error.message);
      return;
    }
    setProjects((p) => p.map((x) => x.id === id ? { ...x, name: renameValue.trim() } : x));
    setRenamingId(null);
    toast.success("Simulation renamed successfully");
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
              <div key={i} className="bg-white/80 backdrop-blur-sm rounded-[22px] border border-gray-100 flex flex-col h-[340px] animate-pulse overflow-hidden shadow-sm">
                <div className="h-[145px] bg-gradient-to-b from-gray-100/70 to-gray-50/50 flex items-center justify-center relative">
                  <div className="w-16 h-16 rounded-2xl bg-gray-200/60" />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200/70 rounded-full w-3/4" />
                    <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                  </div>
                  <div className="w-full h-px bg-gray-100 my-2" />
                  <div className="flex gap-2.5">
                    <div className="h-10 bg-gray-200/50 rounded-xl flex-1" />
                    <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                  </div>
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
                <motion.div 
                  key={proj.id} 
                  initial={{ opacity: 0, y: 24 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 20 }}
                  className="h-full"
                >
                  <div className="group bg-white rounded-[22px] border border-gray-100/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(87,66,255,0.14)] hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col h-[340px] relative">
                    
                    {/* Top Preview Banner — single artwork focal point */}
                    <div 
                      className="h-[145px] relative flex items-center justify-center shrink-0 border-b border-gray-100/70 overflow-hidden"
                      style={{
                        background: `radial-gradient(110% 120% at 50% 15%, ${type.color}14 0%, #fafbfc 75%)`,
                      }}
                    >
                      {/* Subtle dot pattern grid */}
                      <div 
                        className="absolute inset-0 opacity-[0.45] pointer-events-none"
                        style={{
                          backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
                          backgroundSize: "14px 14px",
                        }}
                      />

                      {/* Top Left: Category badge pill */}
                      <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border border-gray-100 shadow-[0_2px_6px_rgba(0,0,0,0.03)]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
                        <span className="text-[10px] font-extrabold tracking-wider uppercase text-gray-700">
                          {type.label}
                        </span>
                      </div>

                      {/* Top Right: Options menu trigger */}
                      <div className="absolute top-3.5 right-3.5 z-20">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === proj.id ? null : proj.id);
                          }}
                          className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white/90 transition-all"
                          title="More options"
                        >
                          <MoreVertical size={16} strokeWidth={2.5} />
                        </button>

                        {/* Dropdown Menu */}
                        {menuOpenId === proj.id && (
                          <div 
                            className="absolute top-8 right-0 z-30 w-44 bg-white rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.12)] border border-gray-100 py-1.5 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                setRenamingId(proj.id);
                                setRenameValue(proj.name);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-semibold text-gray-700 hover:bg-[#F5F3FF] hover:text-[#5742FF] transition-colors text-left"
                            >
                              <Edit2 size={14} /> Rename
                            </button>
                            <Link
                              href={`/dashboard/project/${proj.id}`}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-semibold text-gray-700 hover:bg-[#F5F3FF] hover:text-[#5742FF] transition-colors text-left"
                            >
                              <ExternalLink size={14} /> Open Editor
                            </Link>
                            <div className="h-px bg-gray-100 my-1" />
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                setDeleteId(proj.id);
                              }}
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Single 3D Simulation Graphic with hover scale */}
                      <div className="relative z-10 w-20 h-20 flex items-center justify-center transform group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 ease-out">
                        <img 
                          src={`/icons/${proj.sim_type}.png`} 
                          alt={type.label} 
                          className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.08)] mix-blend-multiply" 
                        />
                      </div>
                    </div>
                    
                    {/* Content Section — NO duplicate icon */}
                    <div className="p-5 flex flex-col flex-1 bg-white relative z-10">
                      
                      {/* Title row with inline rename */}
                      {isRenaming ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input 
                            autoFocus
                            className="w-full px-2.5 py-1 text-sm font-bold border-2 rounded-lg focus:outline-none focus:border-[#5742FF] transition-colors bg-gray-50 text-gray-900"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && renameProject(proj.id)}
                            onBlur={() => renameProject(proj.id)}
                          />
                          <button onClick={() => renameProject(proj.id)} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors shrink-0">
                            <Check size={16} strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group/title mb-1.5">
                          <Link 
                            href={`/dashboard/project/${proj.id}`} 
                            className="font-extrabold text-[17px] text-[#111827] truncate tracking-[-0.02em] hover:text-[#5742FF] transition-colors"
                            title={proj.name}
                          >
                            {proj.name}
                          </Link>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              setRenamingId(proj.id); 
                              setRenameValue(proj.name); 
                            }} 
                            className="opacity-0 group-hover/title:opacity-100 transition-all p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 shrink-0 ml-1"
                            title="Rename simulation"
                          >
                            <Edit2 size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                      )}

                      {/* Metadata Row */}
                      <div className="flex items-center justify-between text-[12px] font-semibold text-gray-400 mt-1">
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} strokeWidth={2} />
                          {new Date(proj.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-100/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Ready
                        </span>
                      </div>

                      <div className="w-full h-px bg-gray-100 my-4" />
                      
                      {/* Bottom Actions Row */}
                      <div className="flex items-center gap-2.5 mt-auto">
                        <Link 
                          href={`/dashboard/project/${proj.id}`} 
                          className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-[12px] text-[13.5px] font-bold text-[#5742FF] bg-[#F8F7FF] hover:bg-[#5742FF] hover:text-white border border-[#EBE9FF] hover:border-[#5742FF] transition-all duration-200 shadow-sm group/btn"
                        >
                          <span>Open</span>
                          <ArrowRight size={15} strokeWidth={2.5} className="group-hover/btn:translate-x-0.5 transition-transform" />
                        </Link>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(proj.id);
                          }} 
                          className="flex items-center justify-center w-[40px] h-[40px] rounded-[12px] border border-gray-200/80 bg-white text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-200 shrink-0"
                          title="Delete simulation"
                        >
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Create New Simulation Card */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: projects.length * 0.06, type: "spring", stiffness: 260, damping: 20 }}>
              <div 
                onClick={() => setShowModal(true)}
                className="w-full h-[340px] rounded-[22px] border-2 border-dashed border-indigo-200/90 bg-white/70 hover:bg-white hover:border-[#5742FF] flex flex-col items-center justify-center p-6 relative transition-all duration-300 group hover:shadow-[0_16px_36px_-8px_rgba(87,66,255,0.12)] hover:-translate-y-1.5 cursor-pointer text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#F5F3FF] text-[#5742FF] flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-[#5742FF] group-hover:text-white transition-all duration-300 shadow-inner">
                  <Plus size={28} strokeWidth={2.5} />
                </div>
                <h3 className="font-extrabold text-[18px] text-[#111827] mb-1.5 group-hover:text-[#5742FF] transition-colors">
                  Create New Simulation
                </h3>
                <p className="text-[13px] text-gray-500 max-w-[200px] leading-relaxed mb-6">
                  Start building your next simulation model from scratch.
                </p>
                <span 
                  className="px-5 py-2.5 rounded-xl text-white text-[13px] font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 group-hover:scale-[1.02] active:scale-[0.98]" 
                  style={{ background: "linear-gradient(135deg, #5742FF, #4531E5)" }}
                >
                  <Plus size={16} strokeWidth={2.5} />
                  New Simulation
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 14 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.96, opacity: 0, y: 14 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white w-full max-w-[1020px] rounded-[28px] shadow-[0_24px_70px_-12px_rgba(0,0,0,0.22)] relative p-7 sm:p-9 md:p-10 max-h-[92vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Close Button */}
              <button 
                onClick={() => setShowModal(false)} 
                className="absolute top-6 right-6 p-2 rounded-xl bg-gray-100/70 hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors z-20"
                title="Close"
              >
                <X size={18} strokeWidth={2.5} />
              </button>

              {/* Main 2-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                
                {/* ── Left Column: Form Steps (7 cols) ── */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                  
                  {/* Header */}
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50/80 border border-indigo-100/60 flex items-center justify-center text-[#5742FF] shadow-sm shrink-0">
                      <Box size={24} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h2 className="font-bold text-[22px] md:text-[24px] text-[#111827] tracking-tight">
                        New Simulation
                      </h2>
                      <p className="text-[#6B7280] text-[13.5px]">
                        Create a new simulation project to model, analyze and optimize.
                      </p>
                    </div>
                  </div>

                  {/* Step 1: Project Name */}
                  <div>
                    <div className="flex items-start gap-2.5 mb-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-50 text-[#5742FF] font-bold text-[12px] flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <div>
                        <h3 className="text-[14.5px] font-bold text-[#111827]">Project Name</h3>
                        <p className="text-[12.5px] text-gray-400">Give your simulation a clear and descriptive name.</p>
                      </div>
                    </div>

                    <div className="relative mt-2">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Calendar size={17} />
                      </div>
                      <input 
                        autoFocus 
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5742FF]/15 focus:border-[#5742FF] text-[#111827] placeholder-gray-400 font-medium transition-all text-sm shadow-sm" 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Bank Teller Optimization" 
                        onKeyDown={(e) => e.key === "Enter" && newName.trim() && createProject()} 
                      />
                    </div>
                  </div>

                  {/* Step 2: Simulation Domain */}
                  <div>
                    <div className="flex items-start gap-2.5 mb-2.5">
                      <span className="w-6 h-6 rounded-full bg-indigo-50 text-[#5742FF] font-bold text-[12px] flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <div>
                        <h3 className="text-[14.5px] font-bold text-[#111827]">Simulation Domain</h3>
                        <p className="text-[12.5px] text-gray-400">Select the domain that best matches your simulation.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 mt-2.5">
                      {[
                        { 
                          id: "human_queue" as const, 
                          label: "HUMAN QUEUE", 
                          sub: "People, lines, service systems",
                          icon: Users,
                          bg: "bg-indigo-50",
                          text: "text-indigo-600"
                        },
                        { 
                          id: "vehicle" as const, 
                          label: "VEHICLE", 
                          sub: "Traffic, vehicles, transport systems",
                          icon: Car,
                          bg: "bg-red-50",
                          text: "text-red-500"
                        },
                        { 
                          id: "liquid" as const, 
                          label: "LIQUID / MATERIAL", 
                          sub: "Flow of liquids or materials",
                          icon: Droplet,
                          bg: "bg-blue-50",
                          text: "text-blue-500"
                        },
                        { 
                          id: "manufacturing" as const, 
                          label: "MANUFACTURING", 
                          sub: "Production lines, machines, operations",
                          icon: Factory,
                          bg: "bg-emerald-50",
                          text: "text-emerald-600"
                        },
                        { 
                          id: "logistics" as const, 
                          label: "LOGISTICS", 
                          sub: "Warehousing, supply chain, distribution",
                          icon: Package,
                          bg: "bg-orange-50",
                          text: "text-orange-500"
                        },
                        { 
                          id: "network_signal" as const, 
                          label: "NETWORK / SIGNAL", 
                          sub: "Networks, signals, communication",
                          icon: Radio,
                          bg: "bg-purple-50",
                          text: "text-purple-600"
                        }
                      ].map((type) => {
                        const isSelected = newType === type.id;
                        const IconComponent = type.icon;

                        return (
                          <button 
                            key={type.id} 
                            onClick={() => setNewType(type.id)}
                            className={`relative flex flex-col items-center justify-center p-3.5 rounded-2xl transition-all border text-center min-h-[140px]
                              ${isSelected 
                                ? "border-2 border-[#5742FF] bg-[#F8F7FF] shadow-sm" 
                                : "border-gray-100 hover:border-gray-200 bg-white hover:bg-gray-50/50"}`}
                          >
                            {isSelected && (
                              <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#5742FF] text-white flex items-center justify-center shadow-sm">
                                <Check size={11} strokeWidth={3} />
                              </div>
                            )}
                            
                            {/* Icon Squircle */}
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-2.5 ${type.bg} ${type.text}`}>
                              <IconComponent size={22} strokeWidth={2.2} />
                            </div>

                            <div className="text-[11px] font-extrabold tracking-wider text-[#111827] uppercase mb-1">
                              {type.label}
                            </div>
                            <div className="text-[10px] text-gray-500 leading-tight px-0.5">
                              {type.sub}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Right Column: Info & 3D Layer Showcase (5 cols) ── */}
                <div className="lg:col-span-5 lg:border-l lg:border-gray-100 lg:pl-8 flex flex-col justify-between pt-2 lg:pt-0">
                  <div>
                    <span className="text-[10.5px] font-extrabold tracking-[0.16em] uppercase text-[#5742FF] block mb-1.5">
                      SIMULATE SMARTER
                    </span>
                    <h3 className="text-[22px] font-bold text-[#111827] leading-tight tracking-tight mb-2">
                      Turn your ideas <br className="hidden sm:block" />into insights.
                    </h3>
                    <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                      Build, analyze, and optimize real-world systems with powerful simulation tools.
                    </p>

                    {/* Isometric Floating Glass Layers Illustration */}
                    <div className="relative w-full h-[155px] flex flex-col items-center justify-center my-3 overflow-hidden rounded-2xl bg-gradient-to-b from-[#FAF8FF] to-[#F3EFFF] border border-indigo-50">
                      {/* Ambient Grid Dots */}
                      <div 
                        className="absolute inset-0 opacity-[0.35] pointer-events-none"
                        style={{
                          backgroundImage: "radial-gradient(#8b5cf6 1px, transparent 1px)",
                          backgroundSize: "14px 14px",
                        }}
                      />

                      {/* 3D Stacked Layers */}
                      <div className="relative w-44 h-16 flex items-center justify-center mb-1">
                        {/* Top-right Floating Analytics Pill */}
                        <div className="absolute -top-2 right-1 z-30 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/95 shadow-[0_4px_14px_rgba(87,66,255,0.18)] border border-indigo-100/90">
                          <span className="text-[10px] font-black text-[#5742FF]">E</span>
                          <BarChart3 size={13} strokeWidth={2.5} className="text-[#5742FF]" />
                        </div>

                        {/* Layer 3: Bottom colored base */}
                        <div 
                          className="absolute w-28 h-12 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] opacity-90 shadow-[0_8px_20px_rgba(99,102,241,0.28)]"
                          style={{ transform: "rotateX(60deg) rotateZ(-45deg) translateZ(0px)" }}
                        />
                        {/* Layer 2: Middle frosted layer */}
                        <div 
                          className="absolute w-28 h-12 rounded-xl bg-white/80 backdrop-blur-md border border-white shadow-[0_6px_18px_rgba(99,102,241,0.15)]"
                          style={{ transform: "rotateX(60deg) rotateZ(-45deg) translateZ(16px)" }}
                        />
                        {/* Layer 1: Top glass layer */}
                        <div 
                          className="absolute w-28 h-12 rounded-xl bg-white/95 backdrop-blur-md border border-indigo-100 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                          style={{ transform: "rotateX(60deg) rotateZ(-45deg) translateZ(32px)" }}
                        />
                      </div>

                      {/* Model → Analyze → Optimize pill */}
                      <div className="relative z-10 px-3 py-0.5 rounded-full bg-white/95 border border-indigo-100 shadow-sm text-[10.5px] font-semibold text-[#5742FF]">
                        Model → Analyze → Optimize
                      </div>
                    </div>

                    {/* 3 Value Propositions */}
                    <div className="space-y-3.5 mt-5">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#5742FF] flex items-center justify-center shrink-0 mt-0.5">
                          <BarChart3 size={16} strokeWidth={2.2} />
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold text-[#111827]">Make better decisions</h4>
                          <p className="text-[11.5px] text-gray-400 leading-tight">Test ideas before real-world implementation.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#5742FF] flex items-center justify-center shrink-0 mt-0.5">
                          <Clock size={16} strokeWidth={2.2} />
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold text-[#111827]">Save time & resources</h4>
                          <p className="text-[11.5px] text-gray-400 leading-tight">Identify bottlenecks and optimize processes.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#5742FF] flex items-center justify-center shrink-0 mt-0.5">
                          <Shield size={16} strokeWidth={2.2} />
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold text-[#111827]">Built for innovators</h4>
                          <p className="text-[11.5px] text-gray-400 leading-tight">Flexible, powerful, and easy to use.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-6 mt-8 border-t border-gray-100 flex items-center justify-between">
                <button 
                  onClick={() => setShowModal(false)} 
                  className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-[13.5px] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={createProject} 
                  disabled={creating || !newName.trim()} 
                  className="px-7 py-2.5 rounded-xl text-white font-bold text-[13.5px] flex items-center gap-2 transition-all bg-[#5742FF] hover:bg-[#4531E5] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-[0_4px_16px_rgba(87,66,255,0.35)] active:scale-[0.99]"
                >
                  {creating && <Loader2 size={16} className="animate-spin" />}
                  <span>Create Project</span>
                  <ArrowRight size={15} strokeWidth={2.5} />
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
