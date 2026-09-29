"use client";
import React from "react";
import Link from "next/link";
import { Ban, LinkIcon, Lock, Rocket } from "lucide-react";

const COPY = {
  revoked: {
    title: "This Share Link Was Revoked",
    body: "The owner of this simulation turned off this link. Ask them for a new link if you still need access.",
  },
  invalid: {
    title: "This Share Link Doesn't Exist",
    body: "This link is either mistyped or the project it pointed to is no longer being shared.",
  },
  "no-access": {
    title: "You Need Access",
    body: "This simulation is only shared with specific people. Ask the owner to invite",
  },
};

export default function ShareLinkUnavailable({ reason, email }: { reason: "revoked" | "invalid" | "no-access"; email?: string }) {
  const revoked = reason === "revoked";
  const copy = COPY[reason];

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-bg-surface-sunken px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center justify-center mb-6">
        {revoked ? (
          <Ban size={26} className="text-amber-500" />
        ) : reason === "no-access" ? (
          <Lock size={26} className="text-[#5742FF]" />
        ) : (
          <LinkIcon size={26} className="text-gray-400" />
        )}
      </div>

      <h1 className="text-[20px] font-extrabold text-[#111827] tracking-tight mb-2">
        {copy.title}
      </h1>
      <p className="text-[13.5px] text-gray-500 max-w-sm mb-8">
        {copy.body}
        {reason === "no-access" && <> <b className="text-gray-700">{email || "your email"}</b>, or sign in with the email they invited.</>}
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
