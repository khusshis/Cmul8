"use client";
import React from "react";
import Link from "next/link";
import { Ban, LinkIcon, Rocket } from "lucide-react";

export default function ShareLinkUnavailable({ reason }: { reason: "revoked" | "invalid" }) {
  const revoked = reason === "revoked";

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-bg-surface-sunken px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center justify-center mb-6">
        {revoked ? (
          <Ban size={26} className="text-amber-500" />
        ) : (
          <LinkIcon size={26} className="text-gray-400" />
        )}
      </div>

      <h1 className="text-[20px] font-extrabold text-[#111827] tracking-tight mb-2">
        {revoked ? "This Share Link Was Revoked" : "This Share Link Doesn't Exist"}
      </h1>
      <p className="text-[13.5px] text-gray-500 max-w-sm mb-8">
        {revoked
          ? "The owner of this simulation turned off public access to it. Ask them for a new link if you still need to view it."
          : "This link is either mistyped or the project it pointed to is no longer being shared."}
      </p>

      <Link
        href="/signup"
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#5742FF] text-white text-[12.5px] font-bold hover:bg-[#4531E5] transition-colors"
      >
        <Rocket size={14} /> Build your own simulation
      </Link>
    </div>
  );
}
