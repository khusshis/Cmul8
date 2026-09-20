import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = 46;

  // ── 1. Header Banner ────────────────────────────────────────────────────────
  doc.setFillColor(87, 66, 255); // Brand Purple #5742FF
  doc.rect(margin, y, contentWidth, 54, "F");

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(255, 255, 255);
  doc.text("JUSTCMUL8 • EXECUTIVE SIMULATION REPORT", margin + 16, y + 24);

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(220, 215, 255);
  doc.text(
    `Project: ${projectName}   |   Domain: ${simConfig.label}   |   Generated: ${new Date().toLocaleString()}`,
    margin + 16,
    y + 42
  );

  y += 72;

  // ── 2. Top Summary Stat Badges ──────────────────────────────────────────────
  const health = result.healthScore ?? 85;
  const efficiency =
    result.totalArrived > 0
      ? Math.round((result.totalCompleted / result.totalArrived) * 100)
      : 100;

  const statCards = [
    { label: "Health Score", value: `${health} / 100` },
    { label: "Completion Rate", value: `${efficiency}%` },
    { label: "Total Completed", value: `${result.totalCompleted} ${simConfig.entityName}s` },
    {
      label: "System Cost",
      value: result.costAnalysis ? `$${result.costAnalysis.totalSystemCost.toFixed(2)}` : "N/A",
    },
  ];

  const cardWidth = (contentWidth - 3 * 10) / 4;
  statCards.forEach((card, idx) => {
    const cardX = margin + idx * (cardWidth + 10);
    doc.setFillColor(248, 247, 255);
    doc.roundedRect(cardX, y, cardWidth, 42, 6, 6, "F");
    doc.setDrawColor(230, 225, 250);
    doc.roundedRect(cardX, y, cardWidth, 42, 6, 6, "S");

    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(120, 110, 160);
    doc.text(card.label.toUpperCase(), cardX + 10, y + 15);

    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(30, 27, 75);
    doc.text(card.value, cardX + 10, y + 32);
  });

  y += 56;

  // ── 3. Embedded Canvas Snapshot ─────────────────────────────────────────────
  if (canvasSnapshotDataUrl) {
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(17, 24, 39);
    doc.text("System Architecture & Network Flow", margin, y);
    y += 12;

    const imgHeight = Math.min(180, contentWidth * 0.42);
    try {
      doc.addImage(canvasSnapshotDataUrl, "PNG", margin, y, contentWidth, imgHeight);
      doc.setDrawColor(229, 231, 235);
      doc.rect(margin, y, contentWidth, imgHeight, "S");
      y += imgHeight + 20;
    } catch {
      // ignore image load errors gracefully
    }
  }

  // ── 4. Executive Diagnosis ──────────────────────────────────────────────────
  if (y > pageHeight - 160) {
    doc.addPage();
    y = 46;
  }

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(17, 24, 39);
  doc.text(result.aiDiagnosis?.title || "System Performance Diagnosis", margin, y);
  y += 14;

  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(75, 85, 99);
  const diagText =
    result.aiDiagnosis?.summary ||
    `Simulation executed for ${result.totalSimTime.toFixed(1)} simulated seconds. System operated at ${efficiency}% completion rate.`;
  const splitDiag = doc.splitTextToSize(diagText, contentWidth);
  doc.text(splitDiag, margin, y);
  y += splitDiag.length * 13 + 16;

  // ── 5. Key Performance Indicators Table ─────────────────────────────────────
  if (y > pageHeight - 180) {
    doc.addPage();
    y = 46;
  }

  const kpiBody = [
    ["Total Volume Inflow", `${result.totalArrived} ${simConfig.entityName}s`],
    ["Total Volume Processed", `${result.totalCompleted} ${simConfig.entityName}s`],
    ["System Completion Rate", `${efficiency}%`],
    ["Median Delay (p50 Wait Time)", `${(result.waitTimePercentiles?.p50 ?? 0).toFixed(2)}s`],
    ["Worst-Case Delay (p95 / p99)", `${(result.waitTimePercentiles?.p95 ?? 0).toFixed(2)}s / ${(result.waitTimePercentiles?.p99 ?? 0).toFixed(2)}s`],
    ["Network Stability (Little's Law)", result.littlesLaw?.isStable ? "Stable (L = λW verified)" : "Backlog detected"],
  ];

  if (result.costAnalysis) {
    kpiBody.push(["Total Operational Cost", `$${result.costAnalysis.totalSystemCost.toFixed(2)}`]);
    kpiBody.push(["Cost Per Completed Item", `$${result.costAnalysis.costPerCompletedEntity.toFixed(2)}`]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Metric Indicator", "Simulated Output Value"]],
    body: kpiBody,
    theme: "striped",
    headStyles: {
      fillColor: [87, 66, 255],
      fontSize: 9,
      fontStyle: "bold",
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [31, 41, 55],
    },
    alternateRowStyles: {
      fillColor: [248, 247, 255],
    },
  });

  y = (doc as any).lastAutoTable.finalY + 20;

  // ── 6. Block Telemetry Breakdown Table ──────────────────────────────────────
  if (y > pageHeight - 160) {
    doc.addPage();
    y = 46;
  }

  const telemetryBody = Object.entries(result.nodeStats || {}).map(([id, s]) => {
    const isBottleneck = result.bottleneckNodeId === id;
    return [
      isBottleneck ? `${s.label} ★ [BOTTLENECK]` : s.label,
      s.nodeType,
      String(s.entitiesIn),
      String(s.entitiesOut),
      `${Math.round((s.utilization ?? 0) * 100)}%`,
      `${(s.avgWaitTime ?? 0).toFixed(1)}s`,
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Station / Block Name", "Type", "In", "Out", "Utilization", "Avg Wait"]],
    body: telemetryBody,
    theme: "striped",
    headStyles: {
      fillColor: [30, 27, 75],
      fontSize: 9,
      fontStyle: "bold",
      textColor: [255, 255, 255],
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [31, 41, 55],
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  });

  y = (doc as any).lastAutoTable.finalY + 20;

  // ── 7. Prescriptive Optimization Recommendations ───────────────────────────
  const recs = result.aiDiagnosis?.recommendations || [];
  if (recs.length > 0) {
    if (y > pageHeight - 180) {
      doc.addPage();
      y = 46;
    }

    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(17, 24, 39);
    doc.text("Prescriptive AI Optimizations", margin, y);
    y += 14;

    recs.forEach((rec, idx) => {
      if (y > pageHeight - 70) {
        doc.addPage();
        y = 46;
      }

      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(87, 66, 255);
      doc.text(`${idx + 1}. ${rec.title} (${rec.confidence}% confidence)`, margin, y);
      y += 12;

      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(55, 65, 81);
      const actionLines = doc.splitTextToSize(`Action: ${rec.action}`, contentWidth - 10);
      doc.text(actionLines, margin + 10, y);
      y += actionLines.length * 11 + 2;

      const impactLines = doc.splitTextToSize(`Expected Benefit: ${rec.impact}`, contentWidth - 10);
      doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(5, 150, 105);
      doc.text(impactLines, margin + 10, y);
      y += impactLines.length * 11 + 10;
    });
  }

  // ── 8. Footers on all pages ────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(156, 163, 175);
    doc.text(
      `JustCmul8 Discrete Event Simulation Engine   •   Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 20
    );
  }

  return doc.output("blob");
}
