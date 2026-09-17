"use client";
import React, { useState, useEffect } from "react";
import { Download, Link2, Copy, Check, Loader2, FileJson, FileSpreadsheet } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function ShareExportModal({
  open, onClose, projectId,
}: { open: boolean; onClose: () => void; projectId: string }) {
  const [tab, setTab] = useState<"export" | "share">("export");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (open && tab === "share") {
      fetch(`/api/projects/${projectId}/share`).then((r) => r.json()).then((d) => setShareUrl(d.url));
    }
  }, [open, tab, projectId]);

  async function createLink() {
    setLoadingShare(true);
    const res = await fetch(`/api/projects/${projectId}/share`, { method: "POST" });
    const data = await res.json();
    setShareUrl(data.url);
    setLoadingShare(false);
  }

  async function revokeLink() {
    setLoadingShare(true);
    await fetch(`/api/projects/${projectId}/share`, { method: "DELETE" });
    setShareUrl(null);
    setLoadingShare(false);
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
    <Modal open={open} onClose={onClose} title="Share & Export">
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-full p-1">
        {(["export", "share"] as const).map((t) => (
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
        <div className="space-y-4">
          <p className="text-[13px] text-gray-500 leading-relaxed">
            Anyone with this link can view a read-only copy of your simulation canvas. They cannot edit it or see your other projects.
          </p>
          {shareUrl ? (
            <>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
                <Link2 size={14} className="text-gray-400 flex-shrink-0" />
                <input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}${shareUrl}`} className="flex-1 bg-transparent text-[12.5px] text-gray-700 outline-none" />
                <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-gray-500" />}
                </button>
              </div>
              <button onClick={revokeLink} disabled={loadingShare} className="text-[12.5px] font-bold text-red-500 hover:text-red-600 transition-colors">
                {loadingShare ? <Loader2 size={12} className="animate-spin inline" /> : "Revoke link"}
              </button>
            </>
          ) : (
            <button
              onClick={createLink}
              disabled={loadingShare}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-accent)] text-white font-bold text-[13.5px] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
            >
              {loadingShare ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              Create shareable link
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
