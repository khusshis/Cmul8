"use client";

import React from "react";
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

export default function LandingPage() {
  return (
    <ReactLenis root>
      <div
        className="relative min-h-screen"
        style={{ background: "var(--bg-primary)" }}
      >
        {/* Global animated cyber-grid overlay */}
        <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />

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
