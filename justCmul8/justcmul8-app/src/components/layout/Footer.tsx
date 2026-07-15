"use client";
import React from "react";
import Link from "next/link";
import { Hexagon, ExternalLink, MessageCircle } from "lucide-react";

export default function Footer() {
  return (
    <footer style={{ background: "var(--bg-secondary)", borderTop: "1px solid", borderImage: "linear-gradient(90deg, var(--neon-cyan), var(--neon-purple)) 1" }}>
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Hexagon size={20} style={{ fill: "rgba(0,242,255,0.15)", stroke: "#00f2ff" }} />
              <span className="font-display font-bold tracking-widest text-neon-cyan" style={{ fontFamily: "var(--font-display)" }}>JUSTCMUL8</span>
            </div>
            <p className="text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>The no-code simulation engine.</p>
            <p className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>© 2025 JustCmul8. All rights reserved.</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex gap-6">
              {[{ label: "Features", href: "/#features" }, { label: "Engine", href: "/#engine" }, { label: "Pricing", href: "/#pricing" }].map((l) => (
                <a key={l.label} href={l.href} className="text-sm transition-colors" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neon-cyan)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                  {l.label}
                </a>
              ))}
            </div>
            <div className="flex gap-4">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub"
                className="transition-colors" style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neon-cyan)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                <ExternalLink size={18} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter"
                className="transition-colors" style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neon-cyan)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
                <MessageCircle size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
