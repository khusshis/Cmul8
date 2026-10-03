"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, ExternalLink, Clock, X, Edit2, Check, ArrowRight, FolderPlus, MoreHorizontal, Loader2,
  Users, Car, Droplets, Factory, Package, RadioTower, Search, Share2, Layers, Coins, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { toast } from "@/components/ui/Toast";
import { Backdrop, SplitWords, spring } from "@/components/landing/motionKit";
import { WorkflowPreview, graphStats } from "@/components/dashboard/WorkflowPreview";
import { Diorama, TYPES as SCENES } from "@/components/landing/SimTypesSection";
import { CREDIT_COSTS, creditErrorMessage, type Billing } from "@/lib/billing/plans";

interface Project {
  id: string;
  name: string;
  sim_type: string;
  updated_at: string;
  user_id: string;
  graph_json?: unknown;
}

// Domains, styled like the landing page. `scene` points at the matching landing diorama.
const DOMAINS: { id: string; label: string; sub: string; icon: LucideIcon; color: string; tint: string; scene: string }[] = [
  { id: "human_queue", label: "People & Service", sub: "People, lines, service systems", icon: Users, color: "#6d5bff", tint: "#eeebff", scene: "human" },
  { id: "vehicle", label: "Traffic & Vehicles", sub: "Traffic, vehicles, transport", icon: Car, color: "#f43f5e", tint: "#ffecef", scene: "vehicle" },
  { id: "liquid", label: "Liquid & Material", sub: "Flow of liquids or materials", icon: Droplets, color: "#0ea5e9", tint: "#e6f6fe", scene: "liquid" },
  { id: "manufacturing", label: "Manufacturing", sub: "Production lines, machines", icon: Factory, color: "#10b981", tint: "#e7f8f1", scene: "mfg" },
  { id: "logistics", label: "Logistics", sub: "Warehousing, supply chain", icon: Package, color: "#f97316", tint: "#fff1e6", scene: "logistics" },
  { id: "network_signal", label: "Network & Signal", sub: "Networks, signals, comms", icon: RadioTower, color: "#8b5cf6", tint: "#f3eeff", scene: "network" },
];
const domainOf = (id: string) => DOMAINS.find((d) => d.id === id) ?? DOMAINS[0];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function timeAgo(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"]];
  let v = s;
  for (const [n, unit] of steps) {
    if (Math.abs(v) < n) return rtf.format(Math.round(v), unit);
    v /= n;
  }
  return "";
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState(DOMAINS[0].id);
  const [creating, setCreating] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  // RLS returns owned + shared projects together; split them like Drive's "My Drive" / "Shared with me".
  const [userId, setUserId] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState("");
  const [view, setView] = React.useState<"mine" | "shared">("mine");
  const [billing, setBilling] = React.useState<Billing | null>(null);

  const mine = projects.filter((p) => p.user_id === userId);
  const shared = projects.filter((p) => p.user_id !== userId);
  const q = query.trim().toLowerCase();
  const visible = (view === "mine" ? mine : shared).filter((p) => !q || p.name.toLowerCase().includes(q));

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
      setBilling((b) => (b ? { ...b, credits: b.credits - CREDIT_COSTS.create_simulation } : b));
      toast.success("Simulation created successfully!", "Project Ready");
      router.push(`/dashboard/project/${data.id}`);
    } else {
      console.error("Supabase Error:", error);
      const noCredits = creditErrorMessage(error?.message);
      toast.error(noCredits || error?.message || "Failed to create project", noCredits ? "Out of credits" : "Creation Error");
    }
    setCreating(false);
  }

  async function deleteProject(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast.error("Failed to delete project: " + error.message); return; }
    setProjects((p) => p.filter((x) => x.id !== id));
    setDeleteId(null);
    toast.success("Simulation deleted successfully");
  }

  async function renameProject(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    const { error } = await supabase.from("projects").update({ name: renameValue.trim() }).eq("id", id);
    if (error) { toast.error("Failed to rename project: " + error.message); return; }
    setProjects((p) => p.map((x) => (x.id === id ? { ...x, name: renameValue.trim() } : x)));
    setRenamingId(null);
    toast.success("Simulation renamed successfully");
  }

  React.useEffect(() => {
    // Load the user and their projects (owned + shared via RLS).
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      // The profile row is the source of truth for the name (Settings edits it there).
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
      setUserName((profile?.display_name || meta?.full_name || meta?.name || user.email?.split("@")[0] || "").split(" ")[0]);
      const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
      setProjects(data || []);
      setLoading(false);
      fetch("/api/billing").then((r) => (r.ok ? r.json() : null)).then(setBilling).catch(() => {});
    });
    // The navbar's "New Simulation" button opens the modal through this event.
    const handleOpenModal = () => setShowModal(true);
    window.addEventListener("open-new-sim-modal", handleOpenModal);
    const handleOutsideClick = () => setMenuOpenId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("open-new-sim-modal", handleOpenModal);
      window.removeEventListener("click", handleOutsideClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastEdited = mine[0]?.updated_at;
  const chosen = domainOf(newType);
  const scene = SCENES.find((s) => s.id === chosen.scene) ?? SCENES[0];

  return (
    <div className="min-h-screen relative overflow-x-clip bg-[#fafaff]">
      <Backdrop tone="a" />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-20 relative z-10">
        {/* Header */}
        <div className="flex flex-col gap-5 mb-8">
          <div>
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-[14px] font-semibold text-[#64748b]">
              {greeting()}{userName ? `, ${userName}` : ""} 👋
            </motion.p>
            <h1 className="mt-1 font-space font-bold text-[2.25rem] sm:text-[2.75rem] leading-[1.05] tracking-[-0.035em] text-[#161622]">
              <SplitWords text="My" accent="Simulations" animateNow breakBeforeAccent={false} />
            </h1>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }} className="mt-4 flex flex-wrap gap-2">
              {[
                { icon: Layers, label: `${mine.length} simulation${mine.length === 1 ? "" : "s"}` },
                { icon: Share2, label: `${shared.length} shared with you` },
                ...(lastEdited ? [{ icon: Clock, label: `Last edited ${timeAgo(lastEdited)}` }] : []),
                ...(billing ? [{ icon: Coins, label: `${billing.credits} credits · ${billing.status === "trialing" ? "Pro trial" : billing.plan === "free" ? "Free" : "Pro"}` }] : []),
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#ecebf7] bg-white px-3 text-[12px] font-semibold text-[#475569] shadow-[0_1px_2px_rgba(16,24,40,.04)]">
                  <Icon size={13} className="text-[#5742FF]" /> {label}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring(12, 0.9, 0.2)} className="flex flex-col sm:flex-row gap-3 sm:items-center">
            {/* Search */}
            <label className="relative flex h-11 items-center rounded-full border border-[#ecebf7] bg-white pl-4 pr-3 shadow-[0_1px_2px_rgba(16,24,40,.04)] focus-within:border-[#c4b5fd] focus-within:shadow-[0_0_0_4px_rgba(139,92,246,.12)] transition-shadow sm:flex-1 sm:max-w-sm">
              <Search size={16} className="text-[#94a3b8] shrink-0" />
              <span className="sr-only">Search simulations</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search simulations" className="ml-2 w-full bg-transparent text-[13.5px] font-medium text-[#161622] placeholder:text-[#94a3b8] outline-none" />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="text-[#94a3b8] hover:text-[#161622]"><X size={14} /></button>
              )}
            </label>
            {/* Mine / shared: sliding pill */}
            <div className="relative sm:ml-auto flex h-11 items-center rounded-full bg-black/[0.04] p-1 shadow-[inset_0_1px_2px_rgba(16,24,40,.06)]" role="tablist">
              {([["mine", "My simulations", mine.length], ["shared", "Shared with me", shared.length]] as const).map(([key, label, n]) => (
                <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)} className="relative h-9 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold">
                  {view === key && (
                    <motion.span layoutId="dash-view-pill" className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_-2px_rgba(16,24,40,.18),inset_0_1px_0_#fff]" transition={spring(20, 0.85)} />
                  )}
                  <span className={`relative transition-colors ${view === key ? "text-[#161622]" : "text-[#64748b] hover:text-[#161622]"}`}>
                    {label}
                    {n > 0 && <span className="ml-1.5 text-[11px] text-[#94a3b8]">{n}</span>}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="hidden sm:inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] px-5 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              <Plus size={16} strokeWidth={2.5} /> New
            </button>
          </motion.div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-3xl border border-[#ecebf7] bg-white overflow-hidden h-[330px] relative">
                <div className="h-[168px] bg-[#f6f5fc]" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-3/4 rounded-full bg-[#f1f0fa]" />
                  <div className="h-3 w-1/2 rounded-full bg-[#f1f0fa]" />
                  <div className="h-10 rounded-xl bg-[#f6f5fc] mt-6" />
                </div>
                {/* Shimmer sweep */}
                <motion.div
                  className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                  animate={{ x: ["0%", "400%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear", delay: i * 0.1 }}
                />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring(12, 0.9)} className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl bg-white border border-[#ecebf7] shadow-[0_12px_28px_-14px_rgba(16,24,40,.25)] flex items-center justify-center mb-6">
              {q ? <Search size={30} className="text-[#5742FF]" /> : view === "shared" ? <Users size={30} className="text-[#5742FF]" /> : <FolderPlus size={30} className="text-[#5742FF]" />}
            </div>
            <h2 className="font-space font-bold text-[22px] tracking-[-0.02em] text-[#161622]">
              {q ? `No simulations match “${query}”` : view === "shared" ? "Nothing shared with you yet" : "No simulations yet"}
            </h2>
            <p className="mt-2 text-sm text-[#64748b] max-w-sm">
              {q ? "Try a different name." : view === "shared" ? "Simulations other people share with your email will show up here." : "Create your first simulation to get started."}
            </p>
            {!q && view === "mine" && (
              <button onClick={() => setShowModal(true)} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] px-6 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(87,66,255,.7)] transition-transform hover:scale-[1.03] active:scale-[0.97]">
                <Plus size={17} strokeWidth={2.5} /> Create first simulation
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence initial={true}>
              {visible.map((proj, i) => {
                const dom = domainOf(proj.sim_type);
                const DomIcon = dom.icon;
                const stats = graphStats(proj.graph_json);
                const isRenaming = renamingId === proj.id;
                const own = proj.user_id === userId;
                return (
                  <motion.div
                    key={proj.id}
                    layout
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ ...spring(13, 0.85, Math.min(i, 10) * 0.04), opacity: { duration: 0.3, delay: Math.min(i, 10) * 0.04 } }}
                  >
                    <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#ecebf7] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(16,24,40,.28)]">
                      {/* Workflow preview */}
                      <Link href={`/dashboard/project/${proj.id}`} className="relative block h-[168px] shrink-0 overflow-hidden border-b border-[#f1f0fa]" style={{ background: `linear-gradient(180deg, #fff, ${dom.tint})` }} aria-label={`Open ${proj.name}`}>
                        <div
                          aria-hidden
                          className="absolute inset-0"
                          style={{ backgroundImage: "radial-gradient(rgba(22,22,34,.09) 1px, transparent 1.5px)", backgroundSize: "16px 16px" }}
                        />
                        <div className="absolute inset-3 transition-transform duration-500 group-hover:scale-[1.04]">
                          <WorkflowPreview graph={proj.graph_json} accent={dom.color} />
                        </div>
                        {stats.blocks > 0 && (
                          <span className="absolute bottom-2.5 left-3 rounded-full bg-white/90 border border-white px-2 py-0.5 text-[10.5px] font-semibold text-[#64748b] shadow-[0_2px_6px_-2px_rgba(16,24,40,.15)]">
                            {stats.blocks} blocks · {stats.links} links
                          </span>
                        )}
                        <span className="absolute bottom-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-[#161622] px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                          Open editor <ArrowRight size={12} />
                        </span>
                      </Link>

                      {/* Menu */}
                      {own && (
                        <div className="absolute top-3 right-3 z-20">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === proj.id ? null : proj.id); }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 border border-white text-[#64748b] shadow-[0_2px_6px_-2px_rgba(16,24,40,.2)] hover:text-[#161622] transition-colors"
                            aria-label="More options"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          <AnimatePresence>
                            {menuOpenId === proj.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-10 w-44 origin-top-right rounded-2xl border border-[#ecebf7] bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(16,24,40,.25)]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button onClick={() => { setMenuOpenId(null); setRenamingId(proj.id); setRenameValue(proj.name); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[#334155] hover:bg-[#f6f4ff] hover:text-[#5742FF]">
                                  <Edit2 size={14} /> Rename
                                </button>
                                <Link href={`/dashboard/project/${proj.id}`} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-[#334155] hover:bg-[#f6f4ff] hover:text-[#5742FF]">
                                  <ExternalLink size={14} /> Open editor
                                </Link>
                                <div className="my-1 h-px bg-[#f1f0fa]" />
                                <button onClick={() => { setMenuOpenId(null); setDeleteId(proj.id); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold text-red-600 hover:bg-red-50">
                                  <Trash2 size={14} /> Delete
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Body */}
                      <div className="flex flex-1 flex-col p-4 sm:p-5">
                        <span className="inline-flex w-max items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: dom.tint, color: dom.color }}>
                          <DomIcon size={12} strokeWidth={2.4} /> {dom.label}
                        </span>

                        {isRenaming ? (
                          <div className="mt-2.5 flex items-center gap-2">
                            <input
                              autoFocus
                              className="w-full rounded-xl border-2 border-[#c4b5fd] bg-[#faf9ff] px-2.5 py-1.5 text-[15px] font-bold text-[#161622] outline-none"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && renameProject(proj.id)}
                              onBlur={() => renameProject(proj.id)}
                            />
                            <button onClick={() => renameProject(proj.id)} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" aria-label="Save name">
                              <Check size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <Link href={`/dashboard/project/${proj.id}`} className="mt-2.5 truncate font-space text-[18px] font-bold tracking-[-0.02em] text-[#161622] hover:text-[#5742FF] transition-colors" title={proj.name}>
                            {proj.name}
                          </Link>
                        )}

                        <div className="mt-1.5 flex items-center justify-between text-[12px] font-medium text-[#94a3b8]">
                          <span className="flex items-center gap-1.5" title={new Date(proj.updated_at).toLocaleString()}>
                            <Clock size={13} /> Edited {timeAgo(proj.updated_at)}
                          </span>
                          {!own && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#f6f4ff] px-2 py-0.5 text-[10.5px] font-bold text-[#5742FF]">
                              <Share2 size={10} /> Shared
                            </span>
                          )}
                        </div>

                        <div className="mt-auto flex items-center gap-2 pt-4">
                          <Link
                            href={`/dashboard/project/${proj.id}`}
                            className="group/btn flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#ebe9ff] bg-[#f8f7ff] text-[13.5px] font-bold text-[#5742FF] transition-colors hover:border-[#5742FF] hover:bg-[#5742FF] hover:text-white"
                          >
                            Open <ArrowRight size={15} strokeWidth={2.5} className="transition-transform group-hover/btn:translate-x-0.5" />
                          </Link>
                          {own && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteId(proj.id); }}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ecebf7] bg-white text-[#94a3b8] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                              aria-label="Delete simulation"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* New simulation card */}
              {view === "mine" && !q && (
                <motion.button
                  key="__new"
                  layout
                  onClick={() => setShowModal(true)}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring(13, 0.85, Math.min(visible.length, 10) * 0.04)}
                  className="group relative flex min-h-[330px] flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-[#d9d3fb] bg-white/60 p-6 text-center transition-[border-color,background-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-[#5742FF] hover:bg-white hover:shadow-[0_24px_48px_-24px_rgba(87,66,255,.35)]"
                >
                  <span className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f3ff] text-[#5742FF] transition-all duration-300 group-hover:rotate-90 group-hover:bg-[#5742FF] group-hover:text-white">
                    <Plus size={28} strokeWidth={2.5} />
                  </span>
                  <span className="font-space text-[18px] font-bold tracking-[-0.02em] text-[#161622] group-hover:text-[#5742FF] transition-colors">New simulation</span>
                  <span className="mt-1.5 max-w-[210px] text-[13px] leading-relaxed text-[#64748b]">Start from a blank canvas in any of six domains.</span>
                  <span className="mt-5 flex -space-x-2">
                    {DOMAINS.map((d) => (
                      <span key={d.id} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm" style={{ background: d.tint, color: d.color }}>
                        <d.icon size={14} />
                      </span>
                    ))}
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Create modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#161622]/40 p-4 md:p-6 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 14 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="custom-scrollbar relative grid max-h-[92vh] w-full max-w-[1040px] grid-cols-1 overflow-y-auto rounded-[28px] bg-white shadow-[0_24px_70px_-12px_rgba(0,0,0,0.3)] lg:grid-cols-[1fr_440px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setShowModal(false)} className="absolute right-5 top-5 z-20 rounded-full bg-white/90 p-2 text-[#94a3b8] shadow-sm hover:text-[#161622]" aria-label="Close">
                <X size={18} strokeWidth={2.5} />
              </button>

              {/* Form */}
              <div className="flex flex-col p-6 sm:p-8">
                <h2 className="font-space text-[26px] font-bold tracking-[-0.03em] text-[#161622]">New simulation</h2>
                <p className="mt-1 text-[14px] text-[#64748b]">Name it, pick a domain, and you&apos;re in the editor.</p>

                <label className="mt-7 text-[12px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]" htmlFor="new-sim-name">Project name</label>
                <input
                  id="new-sim-name"
                  autoFocus
                  className="mt-2 h-12 w-full rounded-2xl border border-[#e7e5f6] bg-[#fafaff] px-4 text-[15px] font-medium text-[#161622] outline-none transition-shadow placeholder:text-[#94a3b8] focus:border-[#c4b5fd] focus:shadow-[0_0_0_4px_rgba(139,92,246,.12)]"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Bank teller optimisation"
                  onKeyDown={(e) => e.key === "Enter" && newName.trim() && createProject()}
                />

                <span className="mt-6 text-[12px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">Domain</span>
                <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {DOMAINS.map((d) => {
                    const on = newType === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setNewType(d.id)}
                        className={`relative flex flex-col items-start rounded-2xl border p-3 text-left transition-[border-color,box-shadow,background-color] ${on ? "bg-white shadow-[0_10px_24px_-14px_rgba(16,24,40,.3)]" : "border-[#ecebf7] bg-white hover:border-[#dcd8f3]"}`}
                        style={on ? { borderColor: d.color, boxShadow: `0 0 0 3px ${d.color}22` } : undefined}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors" style={{ background: on ? d.color : d.tint, color: on ? "#fff" : d.color }}>
                          <d.icon size={18} strokeWidth={2.2} />
                        </span>
                        <span className="mt-2.5 text-[13px] font-bold text-[#161622]">{d.label}</span>
                        <span className="text-[11.5px] leading-snug text-[#94a3b8]">{d.sub}</span>
                        {on && (
                          <motion.span layoutId="domain-check" className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: d.color }} transition={spring(20, 0.8)}>
                            <Check size={11} strokeWidth={3} />
                          </motion.span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex items-center justify-end gap-3 border-t border-[#f1f0fa] pt-6">
                  <button onClick={() => setShowModal(false)} className="h-11 rounded-full px-5 text-[14px] font-semibold text-[#475569] hover:bg-black/[0.04]">
                    Cancel
                  </button>
                  <button
                    onClick={createProject}
                    disabled={creating || !newName.trim()}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] px-6 text-[14px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(87,66,255,.7)] transition-[transform,opacity] hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating && <Loader2 size={16} className="animate-spin" />}
                    Create project · {CREDIT_COSTS.create_simulation} credits <ArrowRight size={15} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Live preview of the chosen domain (the landing diorama) */}
              <div className="relative hidden min-h-[460px] overflow-hidden lg:block" style={{ background: `linear-gradient(180deg, #ffffff 0%, ${chosen.tint} 100%)` }}>
                <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(22,22,34,.08) 1.1px, transparent 1.6px)", backgroundSize: "22px 22px" }} />
                <div className="absolute left-6 top-6 z-10">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: chosen.color }}>Preview</div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={chosen.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="font-space text-[20px] font-bold tracking-[-0.02em] text-[#161622]">
                      {chosen.label}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={scene.id} className="absolute inset-x-0 bottom-4 top-16" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.3 }}>
                    <div className="lp-float-slow absolute inset-0">
                      <Diorama t={scene} live />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-[#161622]/40 p-4 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              transition={spring(16, 0.85)}
              className="w-full max-w-sm rounded-[24px] bg-white p-6 text-center shadow-[0_24px_60px_-12px_rgba(0,0,0,.3)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                <Trash2 size={24} />
              </div>
              <h3 className="font-space text-[20px] font-bold tracking-[-0.02em] text-[#161622]">Delete simulation?</h3>
              <p className="mt-1.5 text-[14px] text-[#64748b]">This can&apos;t be undone.</p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setDeleteId(null)} className="h-11 flex-1 rounded-full border border-[#e7e5f6] text-[14px] font-semibold text-[#334155] hover:bg-[#fafaff]">Cancel</button>
                <button onClick={() => deleteProject(deleteId)} className="h-11 flex-1 rounded-full bg-red-500 border border-red-400 text-[14px] font-semibold text-white hover:bg-red-600">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
