import React from "react";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Navbar />
      
      <main className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6" style={{ color: "var(--color-text-primary)" }}>
          JustCmul8
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mb-10" style={{ color: "var(--color-text-secondary)" }}>
          The actual Landing Page will be built in Phase 9. For now, please proceed to Authentication.
        </p>
        
        <div className="flex gap-4">
          <Link href="/signup" className="py-3 px-6 rounded-full text-white font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--color-info)" }}>
            Sign Up
          </Link>
          <Link href="/login" className="py-3 px-6 rounded-full font-medium border hover:opacity-90 transition-opacity" style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}>
            Log In
          </Link>
        </div>
      </main>
    </div>
  );
}
