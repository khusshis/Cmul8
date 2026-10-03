"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, Link2, Check, Loader2, FileJson, FileSpreadsheet, Lock, Globe, UserPlus, X, RotateCcw, Share2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";

type Role = "owner" | "editor" | "viewer";
interface Person { user_id: string | null; email: string; role: Role; display_name: string | null }
interface LinkSettings { url: string; access: "restricted" | "anyone"; role: "viewer" | "editor" }

const selectCls = "h-8 text-[12px] font-bold text-[#475569] bg-white border border-[#ecebf7] rounded-full pl-3 pr-2 hover:border-[#c4b5fd] focus:border-[#c4b5fd] focus:shadow-[0_0_0_3px_rgba(139,92,246,.12)] outline-none cursor-pointer transition-shadow disabled:opacity-50";
const sectionLabel = "text-[12px] font-bold uppercase tracking-[0.12em] text-[#94a3b8] mb-2.5";

export default function ShareExportModal({
  open, onClose, projectId, onAccessChanged,
}: { open: boolean; onClose: () => void; projectId: string; onAccessChanged?: () => void }) {
  const [tab, setTab] = useState<"share" | "export">("share");
  const [exportError, setExportError] = useState<string | null>(null);

  async function download(format: "csv" | "json") {
    setExportError(null);
    const res = await fetch(`/api/projects/${projectId}/export?format=${format}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Export failed" }));
      setExportError(err.error || "Export failed");
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="(.+)"/);
    const filename = match ? match[1] : `export.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open={open} onClose={onClose} title="Share & Export" subtitle="Invite collaborators or download your simulation." icon={<Share2 size={18} strokeWidth={2.3} />} maxWidth="max-w-lg">
      {/* Sliding pill, same as the dashboard's "My simulations / Shared with me" switch */}
      <div className="relative flex h-11 items-center rounded-full bg-black/[0.04] p-1 mb-6 shadow-[inset_0_1px_2px_rgba(16,24,40,.06)]" role="tablist">
        {(["share", "export"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="relative flex-1 h-9 rounded-full text-[13px] font-semibold capitalize">
            {tab === t && (
              <motion.span layoutId="share-tab-pill" className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_-2px_rgba(16,24,40,.18),inset_0_1px_0_#fff]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            <span className={`relative transition-colors ${tab === t ? "text-[#161622]" : "text-[#64748b] hover:text-[#161622]"}`}>{t}</span>
          </button>
        ))}
      </div>

      {tab === "export" ? (
        <div className="space-y-3">
          <button
            onClick={() => download("json")}
            className="group w-full flex items-center gap-3.5 p-4 rounded-2xl border border-[#ecebf7] bg-white hover:border-[#c4b5fd] hover:shadow-[0_10px_24px_-14px_rgba(87,66,255,.35)] hover:-translate-y-0.5 transition-all text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f3ff] text-[#5742FF]"><FileJson size={19} /></span>
            <div className="flex-1">
              <div className="font-bold text-[14px] text-[#161622]">Download as JSON</div>
              <div className="text-[12px] text-[#64748b]">Full graph — can be re-imported later</div>
            </div>
            <Download size={16} className="text-[#94a3b8] group-hover:text-[#5742FF] transition-colors" />
          </button>
          <button
            onClick={() => download("csv")}
            className="group w-full flex items-center gap-3.5 p-4 rounded-2xl border border-[#ecebf7] bg-white hover:border-[#c4b5fd] hover:shadow-[0_10px_24px_-14px_rgba(87,66,255,.35)] hover:-translate-y-0.5 transition-all text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7f8f1] text-emerald-600"><FileSpreadsheet size={19} /></span>
            <div className="flex-1">
              <div className="font-bold text-[14px] text-[#161622]">Download as CSV</div>
              <div className="text-[12px] text-[#64748b]">Latest simulation results, block by block</div>
            </div>
            <Download size={16} className="text-[#94a3b8] group-hover:text-[#5742FF] transition-colors" />
          </button>
          {exportError && <p className="text-[12px] text-red-500 px-1">{exportError}</p>}
        </div>
      ) : (
        open && projectId && <SharePanel projectId={projectId} onAccessChanged={onAccessChanged} />
      )}
    </Modal>
  );
}

function SharePanel({ projectId, onAccessChanged }: { projectId: string; onAccessChanged?: () => void }) {
  const [role, setRole] = useState<Role | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [link, setLink] = useState<LinkSettings | null>(null);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("editor");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/share`);
    const d = await res.json();
    if (!res.ok) return toast.error(d.error || "Could not load sharing settings");
    setRole(d.role);
    setPeople(d.people);
    setLink(d.link);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const isOwner = role === "owner";

  // Every mutation: call API, reload the list, tell open sessions to re-check their access.
  async function mutate(url: string, method: string, body: object) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast.error(d.error || "Something went wrong"); return null; }
    await load();
    onAccessChanged?.();
    return d;
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const d = await mutate(`/api/projects/${projectId}/members`, "POST", { email, role: inviteRole });
    if (!d) return;
    setEmail("");
    if (d.emailSent) toast.success(`Invite emailed to ${email}`, "Shared");
    else toast.warning(`Access granted, but the email could not be sent (${d.emailError}). Share the link with them directly.`, "Shared");
  }

  function copyLink() {
    const url = isOwner && link ? link.url : `/dashboard/project/${projectId}`;
    navigator.clipboard.writeText(`${window.location.origin}${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function resetLink() {
    if (!confirm("Create a new link? The current link will stop working and people who joined through it lose access.")) return;
    setBusy(true);
    await fetch(`/api/projects/${projectId}/share`, { method: "DELETE" });
    setBusy(false);
    await load();
    onAccessChanged?.();
  }

  if (!role) {
    return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-[#5742FF]" /></div>;
  }

  return (
    <div className="space-y-5">
      {isOwner && (
        <form onSubmit={invite} className="flex items-center gap-2 h-12 p-1.5 pl-4 rounded-full border border-[#e7e5f6] bg-[#fafaff] focus-within:border-[#c4b5fd] focus-within:shadow-[0_0_0_4px_rgba(139,92,246,.12)] transition-shadow">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Add people by email"
            aria-label="Email address to invite"
            className="flex-1 min-w-0 bg-transparent text-[14px] font-medium text-[#161622] placeholder:text-[#94a3b8] outline-none"
          />
          <select aria-label="Role for new person" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} className={selectCls}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={busy || !email}
            className="flex h-9 items-center gap-1.5 px-4 rounded-full bg-gradient-to-b from-[#6a57ff] to-[#5742FF] border border-[#8d80ff] text-white font-semibold text-[13px] shadow-[0_8px_20px_-8px_rgba(87,66,255,.7),inset_0_1px_0_rgba(255,255,255,.35)] hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100 transition-transform"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Invite
          </button>
        </form>
      )}

      <div>
        <div className={sectionLabel}>People with access</div>
        <ul className="space-y-1 max-h-[240px] overflow-y-auto custom-scrollbar -mx-2">
          {people.map((p) => (
            <li key={p.email} className="flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-[#fafaff] transition-colors">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 ${p.role === "owner" ? "bg-gradient-to-b from-[#6a57ff] to-[#5742FF] text-white" : "bg-[#f5f3ff] text-[#5742FF]"}`}>
                {(p.display_name || p.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold text-[#161622] truncate">{p.display_name || p.email.split("@")[0]}</div>
                <div className="text-[12px] text-[#64748b] truncate">
                  {p.email}{!p.user_id && p.role !== "owner" && <span className="ml-1 text-amber-600">· pending sign-up</span>}
                </div>
              </div>
              {p.role === "owner" || !isOwner ? (
                <span className={`text-[11.5px] font-bold capitalize px-2.5 py-1 rounded-full ${p.role === "owner" ? "bg-[#f5f3ff] text-[#5742FF]" : "bg-black/[0.04] text-[#64748b]"}`}>{p.role}</span>
              ) : (
                <div className="flex items-center gap-1">
                  <select
                    aria-label={`Role for ${p.email}`}
                    value={p.role}
                    disabled={busy}
                    onChange={(e) => mutate(`/api/projects/${projectId}/members`, "PATCH", { email: p.email, role: e.target.value })}
                    className={selectCls}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => mutate(`/api/projects/${projectId}/members`, "DELETE", { email: p.email })}
                    disabled={busy}
                    title={`Remove ${p.email}`}
                    aria-label={`Remove ${p.email}`}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-[#94a3b8] hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isOwner && link && (
        <div>
          <div className={sectionLabel}>General access</div>
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-[#ecebf7] bg-[#fafaff]">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${link.access === "anyone" ? "bg-[#e7f8f1] text-emerald-600" : "bg-white border border-[#ecebf7] text-[#64748b]"}`}>
              {link.access === "anyone" ? <Globe size={15} /> : <Lock size={15} />}
            </div>
            <div className="flex-1 min-w-0">
              <select
                aria-label="Who can open the link"
                value={link.access}
                disabled={busy}
                onChange={(e) => mutate(`/api/projects/${projectId}/share`, "PATCH", { access: e.target.value, role: link.role })}
                className={`${selectCls} text-[#161622]`}
              >
                <option value="restricted">Restricted</option>
                <option value="anyone">Anyone with the link</option>
              </select>
              <div className="text-[12px] text-[#64748b] mt-1 px-1">
                {link.access === "anyone" ? "Anyone who signs in with this link can open it" : "Only people added above can open with this link"}
              </div>
            </div>
            {link.access === "anyone" && (
              <select
                aria-label="Link role"
                value={link.role}
                disabled={busy}
                onChange={(e) => mutate(`/api/projects/${projectId}/share`, "PATCH", { access: link.access, role: e.target.value })}
                className={selectCls}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-5 border-t border-[#f1f0fa]">
        {isOwner ? (
          <button onClick={resetLink} disabled={busy} className="flex h-10 items-center gap-1.5 px-3 -ml-3 rounded-full text-[13px] font-semibold text-[#64748b] hover:text-red-500 hover:bg-red-50 transition-colors">
            <RotateCcw size={12} /> Reset link
          </button>
        ) : (
          <span className="text-[13px] text-[#64748b]">You have <b className="capitalize">{role}</b> access</span>
        )}
        <button
          onClick={copyLink}
          className="flex h-10 items-center gap-2 px-5 rounded-full border border-[#ebe9ff] bg-[#f8f7ff] text-[13.5px] font-bold text-[#5742FF] hover:border-[#5742FF] hover:bg-[#5742FF] hover:text-white transition-colors"
        >
          {copied ? <Check size={15} strokeWidth={2.5} /> : <Link2 size={15} />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
