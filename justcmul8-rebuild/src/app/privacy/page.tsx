import type { Metadata } from "next";
import PrivacyContent from "@/components/legal/PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy Policy · JustCmul8",
  description: "What JustCmul8 collects, why, who it's shared with, and the control you have over your data.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
