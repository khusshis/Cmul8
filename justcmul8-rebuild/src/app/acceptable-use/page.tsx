import type { Metadata } from "next";
import AcceptableUseContent from "@/components/legal/AcceptableUseContent";

export const metadata: Metadata = {
  title: "Acceptable Use Policy · JustCmul8",
  description: "What you can and can't do with JustCmul8: illegal content, security, scraping, AI credits and other people's data.",
};

export default function AcceptableUsePage() {
  return <AcceptableUseContent />;
}
