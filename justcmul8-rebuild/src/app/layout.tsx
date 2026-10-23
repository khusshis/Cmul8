import type { Metadata } from "next";
import { Inter, Space_Grotesk, Great_Vibes } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const greatVibes = Great_Vibes({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-great-vibes",
});

export const metadata: Metadata = {
  title: "JustCmul8 - Build Simulations",
  description: "Create, run and analyze discrete event simulations — visually, with no code, and right in your browser.",
};

import SmoothScroll from "@/components/SmoothScroll";
import SplashScreen from "@/components/SplashScreen";
import ToastContainer from "@/components/ui/Toast";
import PageScrollbar from "@/components/PageScrollbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${greatVibes.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved (or system) theme before first paint so dark mode never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <SplashScreen />
        <ToastContainer />
        <PageScrollbar />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
