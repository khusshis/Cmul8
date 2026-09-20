# Feature: One-Click Executive PDF Report Generator

## Status before this feature
**Partial (~40%).** A real report generator already exists: `src/lib/simulation/reportGenerator.ts`'s `generateExecutiveHtmlReport(result, projectName)` builds a styled HTML document (KPI cards, AI diagnosis text, block telemetry table, recommendations list), and `AdvancedResultsDashboard.tsx:74-82`'s `handlePrintReport()` opens it in a new window with a "Print / Save PDF" button. **What's missing:**
- It's not actually a PDF — it's HTML the user must manually `Ctrl+P` → "Save as PDF" through the browser print dialog. Not "one-click."
- No canvas/graph snapshot image — `no <img>/<canvas>/<svg>` elements anywhere in the generated HTML (verified: the template only has numeric cards and an HTML `<table>`).
- No embedded charts — same issue, all data is presented as numbers/tables, no visual charts.
- Not IEEE-formatted (no two-column academic layout, no abstract/references style) — matters only if the deliverable specifically needs to look like an academic paper; otherwise the current clean-dashboard style is fine and arguably better for a business audience. Confirm which is wanted before doing the IEEE-restyling work (see Step 4, optional).
- `package.json` has zero PDF-generation libraries (`jspdf`, `react-pdf`, `puppeteer`, `html2canvas` — none present).

## What this feature does
Turns "Print / Save PDF" into an actual one-click binary `.pdf` download that includes a real snapshot of the simulation canvas and (optionally) embedded chart images — a true deliverable the user can hand to a professor or attach to an email, not a print-dialog workaround.

---

## Implementation plan

### Step 1 — Choose the PDF generation approach

Two viable approaches, pick one:

**Option A (Recommended): Client-side `jsPDF` + `html2canvas`.** Renders the existing DOM (or a purpose-built report layout) to a canvas image, then places that image into a PDF. Zero server infrastructure needed, works entirely in the browser, consistent with this being a "100% browser, no server-side processing" app (per the synopsis's own "What Makes JustCmul8 Unique" section). Slightly lower text fidelity (report text becomes part of a rasterized image rather than selectable PDF text) — acceptable tradeoff for a demo-quality report.

```bash
npm install jspdf html2canvas
```

**Option B: `@react-pdf/renderer`.** Produces genuinely vector, selectable-text PDFs by describing the report as React components (`<Document>`, `<Page>`, `<Text>`, `<Image>`) that render directly to PDF primitives — no DOM screenshotting. Higher quality output, more code to write (a whole parallel "PDF version" of the report layout, separate from the existing `reportGenerator.ts` HTML template), and no built-in way to embed live recharts SVG charts (must pre-rasterize those to PNG first anyway). Pick this only if PDF text-selectability specifically matters (e.g. for accessibility or copy-paste into other documents).

This plan uses **Option A** since it reuses the most existing work.

```bash
npm install jspdf html2canvas
```

### Step 2 — Capture a real canvas snapshot

The graph canvas is a ReactFlow instance (`src/components/workspace/NodeCanvas.tsx`, uses `@xyflow/react`). React Flow exposes a built-in image-export utility (`toPng`/`toJpeg` from `@xyflow/react`'s `useReactFlow()`/viewport export helpers) that is more reliable than generic `html2canvas` on the canvas specifically, because ReactFlow already knows how to serialize its own SVG/DOM nodes cleanly. Check `@xyflow/react`'s docs for `getNodesBounds`/`getViewportForBounds` + the `toPng` export helper (commonly documented as the "Download Image" example in React Flow's own docs) — `@xyflow/react` is already a dependency (`package.json`) so no new install is needed for this specific piece.

```tsx
// src/components/workspace/NodeCanvas.tsx or a new helper it exposes
import { toPng } from "html-to-image"; // @xyflow/react's official example uses html-to-image
// If html-to-image isn't already installed, add it: npm install html-to-image (tiny, no heavy deps)

export async function captureCanvasSnapshot(reactFlowWrapperEl: HTMLElement): Promise<string> {
  const dataUrl = await toPng(reactFlowWrapperEl, {
    backgroundColor: "#ffffff",
    width: reactFlowWrapperEl.clientWidth,
    height: reactFlowWrapperEl.clientHeight,
  });
  return dataUrl; // base64 PNG data URL
}
```

Expose a ref/callback from `NodeCanvas.tsx` up to `page.tsx` (it likely already forwards a ref or exposes the ReactFlow instance somewhere — check how `onLoadScenario`/`fitView`-style calls are currently wired from `page.tsx` into `NodeCanvas`, and add the snapshot capability the same way) so the snapshot can be taken at report-generation time, not baked permanently into the canvas component.

### Step 3 — Build the PDF report generator

New file: `src/lib/simulation/pdfReportGenerator.ts`

```ts
import jsPDF from "jspdf";
import type { SimResult } from "./types";
import { SIM_TYPE_REGISTRY } from "./simTypeRegistry";

export async function generateExecutivePdfReport(
  result: SimResult,
  projectName: string,
  canvasSnapshotDataUrl: string | null
): Promise<Blob> {
  const simConfig = SIM_TYPE_REGISTRY[result.simType] || SIM_TYPE_REGISTRY.human_queue;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 48;

  // ── Header ──
  doc.setFontSize(20).setFont("helvetica", "bold").text(projectName, 40, y);
  y += 20;
  doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(100)
    .text(`${simConfig.label} • Sim Time: ${result.totalSimTime.toFixed(1)}s • Health Score: ${result.healthScore ?? 85}/100`, 40, y);
  y += 30;

  // ── Canvas snapshot (the visual "digital twin" proof-of-work) ──
  if (canvasSnapshotDataUrl) {
    const imgWidth = pageWidth - 80;
    const imgHeight = imgWidth * 0.5; // adjust based on actual canvas aspect ratio
    doc.addImage(canvasSnapshotDataUrl, "PNG", 40, y, imgWidth, imgHeight);
    y += imgHeight + 24;
  }

  // ── Executive Diagnosis ──
  doc.setTextColor(0).setFontSize(13).setFont("helvetica", "bold")
    .text(result.aiDiagnosis?.title || "System Performance Overview", 40, y);
  y += 18;
  doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(60);
  const summaryLines = doc.splitTextToSize(result.aiDiagnosis?.summary || "", pageWidth - 80);
  doc.text(summaryLines, 40, y);
  y += summaryLines.length * 13 + 20;

  // ── KPI Table ──
  if (y > 650) { doc.addPage(); y = 48; }
  doc.setFontSize(12).setFont("helvetica", "bold").setTextColor(0).text("Key Performance Indicators", 40, y);
  y += 18;
  const kpiRows = [
    ["Total Arrived", String(result.totalArrived)],
    ["Total Completed", String(result.totalCompleted)],
    ["Completion Rate", `${result.totalArrived > 0 ? Math.round((result.totalCompleted / result.totalArrived) * 100) : 100}%`],
    ["Median Wait (p50)", `${(result.waitTimePercentiles?.p50 ?? 0).toFixed(2)}s`],
    ["Tail Wait (p99)", `${(result.waitTimePercentiles?.p99 ?? 0).toFixed(2)}s`],
  ];
  if (result.costAnalysis) {
    kpiRows.push(["Total System Cost", `$${result.costAnalysis.totalSystemCost.toFixed(2)}`]);
  }
  autoTableRows(doc, kpiRows, 40, y, pageWidth - 80);
  y += kpiRows.length * 18 + 20;

  // ── Block Telemetry Table ──
  if (y > 600) { doc.addPage(); y = 48; }
  doc.setFontSize(12).setFont("helvetica", "bold").text("Block Telemetry", 40, y);
  y += 18;
  const blockRows = Object.entries(result.nodeStats).map(([id, s]) => [
    s.label + (result.bottleneckNodeId === id ? " (BOTTLENECK)" : ""),
    s.nodeType,
    String(s.entitiesIn),
    String(s.entitiesOut),
    `${Math.round((s.utilization ?? 0) * 100)}%`,
  ]);
  autoTableRows(doc, blockRows, 40, y, pageWidth - 80, ["Block", "Type", "In", "Out", "Util"]);

  // ── Recommendations (new page) ──
  doc.addPage();
  y = 48;
  doc.setFontSize(13).setFont("helvetica", "bold").text("Recommendations", 40, y);
  y += 20;
  (result.aiDiagnosis?.recommendations || []).forEach((r, i) => {
    doc.setFontSize(11).setFont("helvetica", "bold").text(`${i + 1}. ${r.title}`, 40, y);
    y += 14;
    doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(80);
    const lines = doc.splitTextToSize(`${r.action} — Impact: ${r.impact}`, pageWidth - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 14;
  });

  return doc.output("blob");
}

// Minimal manual table renderer (avoids pulling in jspdf-autotable as an extra dependency
// unless the team wants nicer table styling — jspdf-autotable is a drop-in plugin for jsPDF
// if this hand-rolled version looks too plain: npm install jspdf-autotable).
function autoTableRows(doc: jsPDF, rows: string[][], x: number, startY: number, width: number, headers?: string[]) {
  let y = startY;
  if (headers) {
    doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(255).setFillColor(87, 66, 255);
    doc.rect(x, y - 10, width, 16, "F");
    const colWidth = width / headers.length;
    headers.forEach((h, i) => doc.text(h, x + 6 + i * colWidth, y));
    y += 16;
  }
  doc.setFont("helvetica", "normal").setTextColor(30);
  rows.forEach((row) => {
    const colWidth = width / row.length;
    row.forEach((cell, i) => doc.text(String(cell), x + 6 + i * colWidth, y));
    y += 18;
  });
}
```

**Recommended upgrade:** swap the hand-rolled `autoTableRows` for the `jspdf-autotable` plugin (`npm install jspdf-autotable`) — it produces properly bordered, striped, auto-paginating tables with one function call (`autoTable(doc, { head: [...], body: [...] })`) instead of manual `y` bookkeeping, which is error-prone (the manual version above will silently overflow off the page bottom if there are many block rows — `jspdf-autotable` handles pagination automatically).

### Step 4 — Wire a real "Download PDF" button

File: `src/components/workspace/AdvancedResultsDashboard.tsx`

Replace/augment `handlePrintReport()` (line 74-82):

```tsx
async function handleDownloadPdf() {
  if (!result) return;
  setPdfGenerating(true);
  try {
    const snapshot = await captureCanvasSnapshot(); // from Step 2, needs a ref/callback into NodeCanvas
    const blob = await generateExecutivePdfReport(result, simConfig.label + " Simulation", snapshot);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${simConfig.label.replace(/\s+/g, "_")}_Executive_Report.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    setPdfGenerating(false);
  }
}
```

```tsx
<button
  onClick={handleDownloadPdf}
  disabled={pdfGenerating}
  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-bold text-gray-700 hover:bg-gray-50 hover:text-[#5742FF] shadow-xs transition-all disabled:opacity-60"
  title="Download a one-click executive PDF report"
>
  <FileText size={14} />
  <span className="hidden sm:inline">{pdfGenerating ? "Generating..." : "Download PDF"}</span>
</button>
```

Keep the existing `handlePrintReport()`/HTML version as a secondary "Print / View HTML" option if desired — it's still useful for on-screen review before committing to a download, and requires no extra work to keep (it already works).

### Step 5 — (Optional) Embed real charts, not just the KPI table

For a more visually rich report, render the same recharts components used in `ExecutiveTab.tsx`/`CostRoiTab.tsx` (see `MD/02-kpi-cost-roi-dashboard.md`) off-screen, rasterize them to PNG via `html2canvas` (already installed from Step 1), and `doc.addImage()` them into the PDF the same way the canvas snapshot is embedded in Step 3. This adds meaningful effort — treat as a stretch goal after the core one-click PDF (Steps 1-4) works.

### Step 6 — (Optional) IEEE two-column academic layout

Only do this if the deliverable specifically needs to look like an academic paper (check with whoever is grading/reviewing the synopsis). `jsPDF` supports manual column layout (compute two `x` offsets, split content between them, track `y` per column) but there's no built-in "IEEE template" — this would be built from scratch as a second PDF layout function alongside `generateExecutivePdfReport`, reusing the same data but restructured into a title/abstract/two-column-body/references shape. Significant extra work; confirm it's actually wanted before starting.

---

## Files touched
- `src/lib/simulation/pdfReportGenerator.ts` — new
- `src/components/workspace/NodeCanvas.tsx` — expose a snapshot-capture method/ref
- `src/components/workspace/AdvancedResultsDashboard.tsx` — new "Download PDF" button, new `pdfGenerating` state
- `package.json` — add `jspdf`, `html2canvas`, `html-to-image`, optionally `jspdf-autotable`

## Definition of done
- [ ] Clicking "Download PDF" produces an actual `.pdf` file download (not a print dialog) within a few seconds.
- [ ] The PDF includes a real image of the current simulation graph, not a placeholder.
- [ ] The PDF includes the same KPI numbers, block telemetry, and recommendations already present in the existing HTML report — no regression versus what `generateExecutiveHtmlReport` currently shows.
- [ ] Works with cost data too if `MD/01-cost-roi-calculator.md` has been implemented (Total System Cost row appears in the KPI table when `result.costAnalysis` is present).
