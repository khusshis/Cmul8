import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "JustCmul8 — No-Code Discrete Event Simulation",
  description:
    "Build complex industrial simulations visually. AI-powered graph generation, in-browser Pyodide/SimPy execution, and real-time 2D visualization. No code required.",
  keywords: [
    "discrete event simulation",
    "no-code simulation",
    "SimPy",
    "process modeling",
    "bottleneck detection",
  ],
  openGraph: {
    title: "JustCmul8 — No-Code Simulation Engine",
    description: "Transform your operations with the no-code simulation engine.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Preconnect for Google Fonts (loaded via CSS @import) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} min-h-full`}>
        {children}
      </body>
    </html>
  );
}
