"use client";
import React from "react";
import Link from "next/link";
import { ExternalLink, MessageCircle } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[var(--color-bg)] border-t border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="space-y-2">
            <Link href="/" className="inline-block mb-1">
              <img
                src="/logo-full-transparent.png"
                alt="JustCmul8 Logo"
                className="h-9 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-[var(--color-text-secondary)]">The no-code simulation engine.</p>
            <p className="text-xs text-[var(--color-text-secondary)]">© 2026 JustCmul8. All rights reserved.</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex gap-6">
              {[{ label: "Features", href: "/#features" }, { label: "Engine", href: "/#engine" }, { label: "Pricing", href: "/#pricing" }].map((l) => (
                <a key={l.label} href={l.href} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                  {l.label}
                </a>
              ))}
            </div>
            <div className="flex gap-4">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                <ExternalLink size={18} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                <MessageCircle size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
