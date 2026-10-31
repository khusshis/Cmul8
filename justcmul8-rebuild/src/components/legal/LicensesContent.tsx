"use client";

import Link from "next/link";
import { Code2, Cpu, Heart, Scale } from "lucide-react";
import LegalPage, { type LegalHighlight, type LegalSection } from "./LegalPage";
import data from "@/lib/legal/thirdPartyLicenses.json";

type Pkg = { name: string; version: string; license: string; repository: string };
const PACKAGES = data.packages as Pkg[];

// Group by licence, biggest group first.
const GROUPS = Object.entries(
  PACKAGES.reduce<Record<string, Pkg[]>>((m, p) => ((m[p.license] ??= []).push(p), m), {})
).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

const RUNTIME = [
  { name: "Pyodide 0.24.1", license: "MPL-2.0", note: "Python in the browser, used unmodified. Source: github.com/pyodide/pyodide", href: "https://github.com/pyodide/pyodide" },
  { name: "CPython and its standard library", license: "PSF License", note: "Bundled inside Pyodide.", href: "https://docs.python.org/3/license.html" },
  { name: "SimPy 4.1.2", license: "MIT", note: "The discrete-event simulation engine.", href: "https://gitlab.com/team-simpy/simpy" },
  { name: "Inter, Space Grotesk, Great Vibes", license: "SIL Open Font License 1.1", note: "Typefaces, served via Google Fonts.", href: "https://openfontlicense.org" },
];

const HIGHLIGHTS: LegalHighlight[] = [
  { icon: Heart, title: "Built on open source", text: `${PACKAGES.length} npm packages plus Pyodide and SimPy make JustCmul8 possible.` },
  { icon: Scale, title: "All allow commercial use", text: "Every licence below permits use in a commercial service like ours." },
  { icon: Code2, title: "Used unmodified", text: "We use these components as published; we don't ship modified copies." },
  { icon: Cpu, title: "Kept up to date", text: "This list is generated from the exact packages we deploy." },
];

const SECTIONS: LegalSection[] = [
  {
    id: "about",
    title: "About this page",
    body: (
      <>
        <p>
          JustCmul8 is proprietary software. It is built with open-source components, and their licences ask us to credit them and reproduce their
          notices. This page does that. The full licence text of each package is in its source repository, linked below.
        </p>
        <p>
          These licences cover the components only. Your use of JustCmul8 itself is governed by our <Link href="/terms">Terms of Service</Link>.
        </p>
      </>
    ),
  },
  {
    id: "runtime",
    title: "Simulation engine and fonts",
    body: (
      <ul>
        {RUNTIME.map((r) => (
          <li key={r.name}>
            <a href={r.href} target="_blank" rel="noopener noreferrer"><strong>{r.name}</strong></a> ({r.license}): {r.note}
          </li>
        ))}
      </ul>
    ),
  },
  {
    id: "notes",
    title: "Licence notes",
    body: (
      <>
        <ul>
          <li>
            <strong>MIT, ISC, BSD, 0BSD, MIT-0, CC0 and Zlib</strong> components may be used freely provided their copyright notices are kept. The
            notices are in each package&apos;s source, linked below.
          </li>
          <li>
            <strong>Apache-2.0</strong> components are used under the Apache License 2.0. Where a component offers a choice, we use it under
            Apache-2.0 (for example DOMPurify, offered under MPL-2.0 or Apache-2.0).
          </li>
          <li>
            <strong>LGPL-3.0</strong>: the image library libvips, bundled with <code>sharp</code>, is used unmodified on our servers to optimise
            images. It is dynamically linked and its source is available from the libvips project.
          </li>
          <li>
            <strong>MPL-2.0</strong>: Pyodide is used unmodified; its source is available from the Pyodide project.
          </li>
          <li>
            <strong>CC-BY-4.0</strong>: browser-support data from the <code>caniuse-lite</code> package, &copy; Alexis Deveria and contributors
            (caniuse.com), used under the Creative Commons Attribution 4.0 licence.
          </li>
        </ul>
        <p>
          Spotted a missing or wrong attribution? Email <a href="mailto:hello@justcmul8.com">hello@justcmul8.com</a> and we&apos;ll fix it.
        </p>
      </>
    ),
  },
  {
    id: "packages",
    title: `All ${PACKAGES.length} npm packages`,
    body: (
      <>
        <p>Every package in our production build, grouped by licence. Open a group to see the packages and their sources.</p>
        {GROUPS.map(([license, pkgs]) => (
          <details key={license} className="my-2 rounded-xl border border-ln-ecebf7 bg-surface px-4 py-2.5">
            <summary className="cursor-pointer font-semibold text-fg-161622">
              {license} <span className="font-normal text-fg-64748b">· {pkgs.length} package{pkgs.length === 1 ? "" : "s"}</span>
            </summary>
            <ul className="mt-2 columns-1 gap-6 sm:columns-2">
              {pkgs.map((p) => (
                <li key={`${p.name}@${p.version}`} className="break-inside-avoid break-all">
                  <a href={p.repository} target="_blank" rel="noopener noreferrer">{p.name}</a> <span className="text-fg-64748b">{p.version}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </>
    ),
  },
];

export default function LicensesContent() {
  return (
    <LegalPage
      current="/licenses"
      title={<>Open-source licences</>}
      intro="The open-source software JustCmul8 is built with, and the licences it is used under."
      effective="1 November 2026"
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
