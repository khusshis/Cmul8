"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Download, Link2, Check, Loader2, FileJson, FileSpreadsheet, Lock, Globe, UserPlus, X, RotateCcw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";

type Role = "owner" | "editor" | "viewer";
interface Person { user_id: string | null; email: string; role: Role; display_name: string | null }
interface LinkSettings { url: string; access: "restricted" | "anyone"; role: "viewer" | "editor" }

const selectCls = "text-[12px] font-bold text-gray-600 bg-transparent rounded-lg px-1.5 py-1 hover:bg-gray-100 outline-none cursor-pointer";

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
    <Modal open={open} onClose={onClose} title="Share & Export" maxWidth="max-w-lg">
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-full p-1">
        {(["share", "export"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-full text-[13px] font-bold capitalize transition-colors ${tab === t ? "bg-white shadow-sm text-[var(--color-text-primary)]" : "text-gray-500"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "export" ? (
        <div className="space-y-3">
          <button
            onClick={() => download("json")}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 transition-colors text-left"
          >
            <FileJson size={20} className="text-[var(--color-accent)]" />
            <div className="flex-1">
              <div className="font-bold text-[13.5px] text-[var(--color-text-primary)]">Download as JSON</div>
              <div className="text-[11.5px] text-gray-500">Full graph — can be re-imported later</div>
            </div>
            <Download size={16} className="text-gray-400" />
          </button>
          <button
            onClick={() => download("csv")}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-200 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 transition-colors text-left"
          >
            <FileSpreadsheet size={20} className="text-emerald-600" />
            <div className="flex-1">
              <div className="font-bold text-[13.5px] text-[var(--color-text-primary)]">Download as CSV</div>
              <div className="text-[11.5px] text-gray-500">Latest simulation results, block by block</div>
            </div>
            <Download size={16} className="text-gray-400" />
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
    return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-5">
      {isOwner && (
        <form onSubmit={invite} className="flex items-center gap-2 p-1.5 pl-3 rounded-xl border border-gray-200 focus-within:border-[var(--color-accent)]">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Add people by email"
            aria-label="Email address to invite"
            className="flex-1 min-w-0 bg-transparent text-[13px] outline-none"
          />
          <select aria-label="Role for new person" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} className={selectCls}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={busy || !email}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--color-accent)] text-white font-bold text-[12.5px] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Invite
          </button>
        </form>
      )}

      <div>
        <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">People with access</div>
        <ul className="space-y-1 max-h-[220px] overflow-y-auto">
          {people.map((p) => (
            <li key={p.email} className="flex items-center gap-3 py-1.5">
              <div className="w-8 h-8 rounded-full bg-[#EEF0FF] text-[#5742FF] flex items-center justify-center font-bold text-[12px] shrink-0">
                {(p.display_name || p.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-gray-800 truncate">{p.display_name || p.email.split("@")[0]}</div>
                <div className="text-[11.5px] text-gray-500 truncate">
                  {p.email}{!p.user_id && p.role !== "owner" && <span className="ml-1 text-amber-600">· pending sign-up</span>}
                </div>
              </div>
              {p.role === "owner" || !isOwner ? (
                <span className="text-[12px] font-bold text-gray-400 capitalize px-1.5">{p.role}</span>
              ) : (
                <div className="flex items-center gap-0.5">
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
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
          <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">General access</div>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${link.access === "anyone" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
              {link.access === "anyone" ? <Globe size={15} /> : <Lock size={15} />}
            </div>
            <div className="flex-1 min-w-0">
              <select
                aria-label="Who can open the link"
                value={link.access}
                disabled={busy}
                onChange={(e) => mutate(`/api/projects/${projectId}/share`, "PATCH", { access: e.target.value, role: link.role })}
                className={`${selectCls} -ml-1.5 text-gray-800`}
              >
                <option value="restricted">Restricted</option>
                <option value="anyone">Anyone with the link</option>
              </select>
              <div className="text-[11.5px] text-gray-500">
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

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        {isOwner ? (
          <button onClick={resetLink} disabled={busy} className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 hover:text-red-500 transition-colors">
            <RotateCcw size={12} /> Reset link
          </button>
        ) : (
          <span className="text-[12px] text-gray-500">You have <b className="capitalize">{role}</b> access</span>
        )}
        <button
          onClick={copyLink}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-[12.5px] font-bold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-colors"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Link2 size={14} />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
