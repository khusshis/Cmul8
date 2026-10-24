import type { Metadata } from "next";
import TermsContent from "@/components/legal/TermsContent";

export const metadata: Metadata = {
  title: "Terms of Service · JustCmul8",
  description: "The rules for using JustCmul8: accounts, plans and credits, your content, AI features and simulation results.",
};

export default function TermsPage() {
  return <TermsContent />;
}
