"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GlassCard from "@/components/ui/GlassCard";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import type { SimTypeId } from "@/lib/simulation/types";
import { Loader2, Check, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [defaultSimType, setDefaultSimType] = useState<SimTypeId>("human_queue");
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUserId(user.id);
    setEmail(user.email || "");

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (profile) {
      setDisplayName(profile.display_name || "");
      setDefaultSimType(profile.default_sim_type || "human_queue");
    } else {
      await supabase.from("profiles").upsert({ id: user.id, display_name: "" });
    }
    setLoading(false);
  }

  async function saveProfile() {
    await supabase.from("profiles").upsert({
      id: userId, display_name: displayName, default_sim_type: defaultSimType, updated_at: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changePassword() {
    setPasswordMsg(null);
    if (newPassword.length < 8) { setPasswordMsg("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg("Passwords don't match."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : "Password updated.");
    if (!error) { setNewPassword(""); setConfirmPassword(""); }
  }

  async function deleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      await supabase.auth.signOut();
      router.push("/");
    } else {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[var(--color-info)]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)] tracking-tight mb-2">Account Settings</h1>

        <GlassCard className="p-6" hover={false}>
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-4">Profile</h2>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Display Name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-surface w-full mb-4" />
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Email</label>
          <input value={email} disabled className="input-surface w-full opacity-60 mb-4" />
          <button onClick={saveProfile} className="px-4 py-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] text-white font-bold text-[13px] hover:bg-[var(--color-accent-hover)] transition-colors flex items-center gap-2">
            {saved ? <><Check size={14} /> Saved</> : "Save Profile"}
          </button>
        </GlassCard>

        <GlassCard className="p-6" hover={false}>
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-4">Preferences</h2>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Default Simulation Domain</label>
          <select value={defaultSimType} onChange={(e) => setDefaultSimType(e.target.value as SimTypeId)} className="input-surface w-full">
            {Object.values(SIM_TYPE_REGISTRY).map((cfg) => (
              <option key={cfg.id} value={cfg.id}>{cfg.label}</option>
            ))}
          </select>
        </GlassCard>

        <GlassCard className="p-6" hover={false}>
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-[var(--color-text-secondary)] mb-4">Security</h2>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-surface w-full mb-3" />
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-surface w-full mb-3" />
          {passwordMsg && <p className="text-[12.5px] text-[var(--color-text-secondary)] mb-3">{passwordMsg}</p>}
          <button onClick={changePassword} className="px-4 py-2 rounded-[var(--radius-control)] bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)] font-bold text-[13px] hover:bg-[var(--color-border)] transition-colors">
            Change Password
          </button>
        </GlassCard>

        <GlassCard className="p-6 border-[var(--color-error)]/30" hover={false}>
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-[var(--color-error)] mb-2 flex items-center gap-2">
            <AlertTriangle size={14} /> Danger Zone
          </h2>
          <p className="text-[12.5px] text-[var(--color-text-secondary)] mb-4">Deleting your account permanently removes all your projects, simulation history, and chat history. This cannot be undone.</p>
          {!deleteConfirmOpen ? (
            <button onClick={() => setDeleteConfirmOpen(true)} className="px-4 py-2 rounded-[var(--radius-control)] bg-[var(--color-accent-soft)] text-[var(--color-error)] font-bold text-[13px] hover:bg-[var(--color-error)]/20 transition-colors">
              Delete Account
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={deleteAccount} disabled={deleting} className="px-4 py-2 rounded-[var(--radius-control)] bg-[var(--color-error)] text-white font-bold text-[13px] disabled:opacity-50">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : "Yes, permanently delete"}
              </button>
              <button onClick={() => setDeleteConfirmOpen(false)} className="px-4 py-2 text-[13px] font-bold text-[var(--color-text-secondary)]">Cancel</button>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
