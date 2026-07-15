"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ExternalLink, LogOut, Clock, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/layout/Navbar";

const SIM_TYPES = [
  { id: "human_queue",    icon: "🧍", label: "HUMAN QUEUE",       color: "var(--neon-green)",   desc: "Bank, hospital, airport queues" },
  { id: "vehicle",        icon: "🚗", label: "VEHICLE",            color: "var(--neon-cyan)",    desc: "Traffic, gas stations, drive-thru" },
  { id: "liquid",         icon: "💧", label: "LIQUID / MATERIAL",  color: "var(--neon-purple)",  desc: "Water treatment, fuel tanks" },
  { id: "manufacturing",  icon: "🏭", label: "MANUFACTURING",      color: "var(--neon-orange)",  desc: "Assembly lines, QC, robots" },
  { id: "logistics",      icon: "📦", label: "LOGISTICS",          color: "var(--neon-yellow)",  desc: "Warehouses, sort centers, docks" },
  { id: "network_signal", icon: "📡", label: "NETWORK / SIGNAL",   color: "var(--neon-magenta)", desc: "Microservices, IoT, pub/sub, CDN" },
];


interface Project { id: string; name: string; sim_type: string; updated_at: string; user_id: string; }

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [userEmail, setUserEmail] = React.useState("");
  const [showModal, setShowModal] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState("human_queue");
  const [creating, setCreating] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserEmail(user.email || "");
    const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  }

  async function createProject() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("projects").insert({
      name: newName.trim(), sim_type: newType, user_id: user!.id,
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
    await supabase.from("projects").delete().eq("id", id);
    setProjects((p) => p.filter((x) => x.id !== id));
    setDeleteId(null);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const getType = (id: string) => SIM_TYPES.find((t) => t.id === id) || SIM_TYPES[0];

  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
      <div className="fixed inset-0 cyber-grid opacity-10 pointer-events-none" />

      {/* Shared cyberpunk Navbar */}
      <Navbar />

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs tracking-widest mb-1" style={{ fontFamily: "var(--font-mono)", color: "var(--neon-cyan)" }}>OPERATOR CONSOLE</p>
            <h1 className="font-display font-bold text-3xl text-white" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>MY SIMULATIONS</h1>
          </div>
          <button id="new-sim-btn" onClick={() => setShowModal(true)} className="btn-cyber-primary animate-pulse-glow">
            <Plus size={18} /> NEW SIMULATION
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-neon-cyan text-sm" style={{ fontFamily: "var(--font-mono)" }}>LOADING SIMULATIONS...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
            <div className="text-6xl opacity-30">🧪</div>
            <div>
              <h2 className="font-display font-bold text-xl text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>NO SIMULATIONS YET</h2>
              <p className="text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>Create your first simulation to get started.</p>
            </div>
            <button onClick={() => setShowModal(true)} className="btn-cyber-primary">
              <Plus size={18} /> CREATE YOUR FIRST SIMULATION
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {projects.map((proj, i) => {
              const type = getType(proj.sim_type);
              return (
                <motion.div key={proj.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="glass-panel hover-glow-cyan p-5 space-y-4 relative group" style={{ borderTop: `2px solid ${type.color}` }}>
                    <div className="text-4xl" style={{ filter: `drop-shadow(0 0 8px ${type.color})` }}>{type.icon}</div>
                    <div>
                      <h3 className="font-semibold text-white text-sm truncate" style={{ fontFamily: "var(--font-body)" }}>{proj.name}</h3>
                      <span className="inline-block text-xs mt-1 px-2 py-0.5 rounded" style={{ background: `${type.color}15`, border: `1px solid ${type.color}40`, color: type.color, fontFamily: "var(--font-mono)" }}>
                        {type.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      <Clock size={10} />
                      {new Date(proj.updated_at).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/project/${proj.id}`} className="btn-cyber-primary flex-1 justify-center" style={{ padding: "8px", fontSize: "0.75rem" }}>
                        <ExternalLink size={12} /> OPEN
                      </Link>
                      <button onClick={() => setDeleteId(proj.id)} className="btn-cyber-danger" style={{ padding: "8px 10px" }}>
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel-heavy p-8 w-full max-w-lg space-y-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-white tracking-wider" style={{ fontFamily: "var(--font-display)" }}>NEW SIMULATION</h2>
                <button onClick={() => setShowModal(false)} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
              </div>

              <div>
                <label className="block text-xs tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>PROJECT NAME</label>
                <input id="new-sim-name" className="input-cyber" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Bank Teller Optimization" onKeyDown={(e) => e.key === "Enter" && createProject()} />
              </div>

              <div>
                <label className="block text-xs tracking-widest mb-3" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>SIMULATION TYPE</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SIM_TYPES.map((type) => (
                    <button key={type.id} id={`sim-type-${type.id}`} onClick={() => setNewType(type.id)}
                      className="p-3 rounded text-center transition-all space-y-1"
                      style={{
                        background: newType === type.id ? `${type.color}15` : "rgba(0,0,0,0.3)",
                        border: `1px solid ${newType === type.id ? type.color : "rgba(255,255,255,0.08)"}`,
                        boxShadow: newType === type.id ? `0 0 12px ${type.color}40` : "none",
                      }}>
                      <div className="text-2xl">{type.icon}</div>
                      <div className="text-xs font-semibold" style={{ fontFamily: "var(--font-mono)", color: newType === type.id ? type.color : "var(--text-muted)" }}>{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button id="create-project-btn" onClick={createProject} disabled={creating || !newName.trim()} className="btn-cyber-primary w-full justify-center" style={{ padding: "14px" }}>
                {creating ? "CREATING..." : "CREATE PROJECT ▶"}
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
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-panel-heavy p-8 w-full max-w-sm space-y-5 text-center">
              <div className="text-4xl">⚠️</div>
              <h3 className="font-display font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>DELETE SIMULATION?</h3>
              <p className="text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>This action cannot be undone. All data will be lost.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="btn-cyber-ghost flex-1">CANCEL</button>
                <button onClick={() => deleteProject(deleteId)} className="btn-cyber-danger flex-1">DELETE</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
