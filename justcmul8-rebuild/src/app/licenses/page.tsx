import type { Metadata } from "next";
import LicensesContent from "@/components/legal/LicensesContent";

export const metadata: Metadata = {
  title: "Open-source licences · JustCmul8",
  description: "The open-source software JustCmul8 is built with, and the licences it is used under.",
};

export default function LicensesPage() {
  return <LicensesContent />;
}
