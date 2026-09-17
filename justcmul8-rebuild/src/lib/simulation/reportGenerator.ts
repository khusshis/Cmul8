import type { SimResult, SimTypeId } from "./types";
import { SIM_TYPE_REGISTRY } from "./simTypeRegistry";

export function generateExecutiveHtmlReport(result: SimResult, projectName: string): string {
  const simConfig = SIM_TYPE_REGISTRY[result.simType] || SIM_TYPE_REGISTRY.human_queue;
  const healthScore = result.healthScore ?? 85;
  const aiDiag = result.aiDiagnosis;
  const littlesLaw = result.littlesLaw;
  const waitP = result.waitTimePercentiles;
  const bottleneck = result.bottleneckNodeId ? result.nodeStats[result.bottleneckNodeId] : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Executive Simulation Report - ${projectName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; color: #111827; padding: 40px; margin: 0; }
    .header { border-bottom: 2px solid #5742FF; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 26px; font-weight: 800; color: #111827; margin: 0; }
    .meta { font-size: 13px; color: #6B7280; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
    .card { background: #FAF9FF; border: 1px solid #ECEBFA; border-radius: 16px; padding: 16px; }
    .card-label { font-size: 11px; font-weight: 700; color: #6B7280; text-transform: uppercase; }
    .card-val { font-size: 24px; font-weight: 800; color: #111827; margin-top: 4px; }
    .diagnosis { background: #F8F7FF; border: 1px solid #5742FF30; border-radius: 18px; padding: 20px; margin: 24px 0; }
    .section-title { font-size: 16px; font-weight: 800; margin: 24px 0 12px; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th { background: #F3F4F6; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; color: #4B5563; }
    td { padding: 10px; border-bottom: 1px solid #E5E7EB; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .badge-optimal { background: #DEF7EC; color: #03543F; }
    .badge-error { background: #FDE8E8; color: #9B1C1C; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${projectName}</h1>
      <div class="meta">Domain: ${simConfig.label} • Simulation Time: ${result.totalSimTime.toFixed(1)}s • Health Score: ${healthScore}/100</div>
    </div>
    <button class="no-print" onclick="window.print()" style="background:#5742FF;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;">
      Print / Save PDF
    </button>
  </div>

  <div class="diagnosis">
    <div style="font-size:12px;font-weight:800;color:#5742FF;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
      Executive Diagnosis
    </div>
    <div style="font-size:18px;font-weight:800;margin-bottom:8px;">${aiDiag?.title || "System Performance Overview"}</div>
    <div style="font-size:14px;color:#4B5563;line-height:1.5;">${aiDiag?.summary || ""}</div>
    ${bottleneck ? `<div style="margin-top:12px;padding:10px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;font-size:13px;color:#92400E;"><strong>Identified Bottleneck:</strong> ${bottleneck.label} (${Math.round((bottleneck.utilization || 0) * 100)}% utilized, ${bottleneck.avgWaitTime.toFixed(1)}s avg wait)</div>` : ""}
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-label">Total Arrived</div>
      <div class="card-val">${result.totalArrived}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Completed</div>
      <div class="card-val" style="color:#10B981;">${result.totalCompleted}</div>
    </div>
    <div class="card">
      <div class="card-label">Efficiency Rate</div>
      <div class="card-val">${result.totalArrived > 0 ? Math.round((result.totalCompleted / result.totalArrived) * 100) : 100}%</div>
    </div>
    <div class="card">
      <div class="card-label">Little's Law Status</div>
      <div class="card-val" style="font-size:18px;color:#5742FF;">${littlesLaw?.isStable ? "Stable Equilibrium" : "Transient/Backlog"}</div>
    </div>
  </div>

  <div class="section-title">Queue & Tail Latency Distribution</div>
  <div class="grid">
    <div class="card">
      <div class="card-label">Median Wait (p50)</div>
      <div class="card-val">${(waitP?.p50 ?? 0).toFixed(2)}s</div>
    </div>
    <div class="card">
      <div class="card-label">High-Load Wait (p90)</div>
      <div class="card-val">${(waitP?.p90 ?? 0).toFixed(2)}s</div>
    </div>
    <div class="card">
      <div class="card-label">Critical Tail (p99)</div>
      <div class="card-val" style="color:#EF4444;">${(waitP?.p99 ?? 0).toFixed(2)}s</div>
    </div>
    <div class="card">
      <div class="card-label">Std Deviation (σ)</div>
      <div class="card-val">${(waitP?.stdDev ?? 0).toFixed(2)}s</div>
    </div>
  </div>

  <div class="section-title">Block Telemetry Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>Block Name</th>
        <th>Type</th>
        <th>Inflow</th>
        <th>Outflow</th>
        <th>Utilization</th>
        <th>Avg Wait Time</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(result.nodeStats).map(([id, s]) => `
        <tr>
          <td><strong>${s.label}</strong> ${result.bottleneckNodeId === id ? '<span class="badge badge-error">BOTTLENECK</span>' : ''}</td>
          <td>${s.nodeType}</td>
          <td>${s.entitiesIn}</td>
          <td>${s.entitiesOut}</td>
          <td>${s.utilization !== undefined ? Math.round(s.utilization * 100) + '%' : '—'}</td>
          <td>${(s.avgWaitTime ?? 0).toFixed(2)}s</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title">Actionable Recommendations</div>
  <div style="margin-top:8px;">
    ${aiDiag?.recommendations?.map((r, i) => `
      <div style="padding:12px;border:1px solid #E5E7EB;border-radius:12px;margin-bottom:8px;">
        <div style="font-weight:700;font-size:14px;color:#111827;">${i + 1}. ${r.title}</div>
        <div style="font-size:13px;color:#4B5563;margin-top:2px;">${r.action} — <em>Impact: ${r.impact}</em></div>
      </div>
    `).join('') || '<p style="color:#6B7280;">No optimization recommendations generated.</p>'}
  </div>

  <div style="margin-top:40px;text-align:center;font-size:11px;color:#9CA3AF;">
    Generated by JustCmul8 Discrete Event Simulation Analytics Suite • ${new Date().toLocaleString()}
  </div>
</body>
</html>`;
}
