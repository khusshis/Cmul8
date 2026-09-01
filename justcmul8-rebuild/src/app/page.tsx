"use client";

import React from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ReactLenis } from "lenis/react";
import Navbar from "@/components/layout/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import TickerSection from "@/components/landing/TickerSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import AISection from "@/components/landing/AISection";
import EngineSection from "@/components/landing/EngineSection";
import SimTypesSection from "@/components/landing/SimTypesSection";
import SecurityPricingSection from "@/components/landing/SecurityPricingSection";
import Footer from "@/components/layout/Footer";

const PreLoader = dynamic(() => import("@/components/layout/PreLoader"), { ssr: false });

export default function LandingPage() {
  const [loaded, setLoaded] = React.useState(false);

  return (
    <ReactLenis root>
      {!loaded && <PreLoader onComplete={() => setLoaded(true)} />}
      <div
        className="relative min-h-screen"
        style={{ background: "var(--bg-primary)", opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease" }}
      >
        {/* Global animated cyber-grid overlay */}
        <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />

        {/* Global Fixed Cyberpunk Minimal Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Image
            src="/cyberpunk_fixed_bg.png"
            alt="Cyberpunk Industrial Background"
            fill
            sizes="100vw"
            className="object-cover opacity-50 mix-blend-screen"
            priority
          />
        </div>

        <Navbar />
        <main>
          <HeroSection />
          <TickerSection />
          <FeaturesSection />
          <AISection />
          <EngineSection />
          <SimTypesSection />
          <SecurityPricingSection />
        </main>
        <Footer />
      </div>
    </ReactLenis>
  );
}
