"use client";

import React from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingDown, Users, PieChart as PieChartIcon, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { SimResult, SimTypeId } from "@/lib/simulation/types";
import { SIM_TYPE_REGISTRY } from "@/lib/simulation/simTypeRegistry";
import { useCountUp } from "@/lib/hooks/useCountUp";

export default function CostRoiTab({ result, simType }: { result: SimResult; simType: SimTypeId }) {
  const cost = result.costAnalysis;
  const simConfig = SIM_TYPE_REGISTRY[simType] || SIM_TYPE_REGISTRY.human_queue;

  const totalCostAnimated = useCountUp(cost?.totalSystemCost || 0, 900, 2);

  if (!cost || cost.totalSystemCost === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-[24px] border border-gray-100 shadow-xs p-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-[#5742FF] flex items-center justify-center mb-4 shadow-xs">
          <DollarSign size={28} />
        </div>
        <h3 className="text-[17px] font-black text-gray-900 mb-1.5">No Cost Data Configured</h3>
        <p className="text-[13px] text-gray-500 max-w-md mb-6 leading-relaxed">
          Set an <strong>Hourly Cost ($/hr)</strong> on a Staff/Machine Resource node, or a <strong>Holding Cost</strong> / <strong>Waiting Penalty</strong> on a Queue node in the Node Configuration Panel — then run the simulation to see full financial analytics here.
        </p>
        <div className="flex items-center gap-2 text-[12px] font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100/60">
          <ArrowUpRight size={14} /> Tip: Click on any Station node on the canvas to set costs
        </div>
      </div>
    );
  }

  const chartData = cost.breakdown.map((b) => ({
    name: b.nodeLabel,
    "Resource Cost": Math.round(b.resourceCost * 100) / 100,
    "Holding Cost": Math.round(b.holdingCost * 100) / 100,
    "Waiting Penalty": Math.round(b.waitingPenalty * 100) / 100,
  }));

  return (
    <div className="space-y-6">
      {/* ── Top Row: Financial Hero Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[20px] bg-white border border-gray-100 shadow-sm p-5"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <DollarSign size={20} />
          </div>
          <div className="text-[28px] font-black text-gray-900 tracking-tight">
            ${totalCostAnimated}
          </div>
          <div className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wider mt-1">
            Total System Cost
          </div>
          <div className="text-[11.5px] text-emerald-600 font-semibold mt-1">
            Across {cost.breakdown.length} active cost centers
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[20px] bg-white border border-gray-100 shadow-sm p-5"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#5742FF] flex items-center justify-center mb-3">
            <Users size={20} />
          </div>
          <div className="text-[28px] font-black text-gray-900 tracking-tight">
            ${cost.costPerCompletedEntity.toFixed(2)}
          </div>
          <div className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wider mt-1">
            Cost Per Completed {simConfig.entityName}
          </div>
          <div className="text-[11.5px] text-gray-400 font-medium mt-1">
            {result.totalCompleted} total {simConfig.entityName.toLowerCase()}s finished
          </div>
        </motion.div>

        {cost.roiVsBaseline ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[20px] bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 shadow-sm p-5"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <TrendingDown size={20} />
            </div>
            <div className="text-[28px] font-black text-emerald-700 tracking-tight">
              -${cost.roiVsBaseline.savedCost.toFixed(2)}
            </div>
            <div className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wider mt-1">
              Saved vs Baseline ({cost.roiVsBaseline.savedPercent.toFixed(0)}% ROI)
            </div>
            <div className="text-[11.5px] text-emerald-700 font-medium mt-1">
              Baseline was ${cost.roiVsBaseline.baselineCost.toFixed(2)}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[20px] bg-white border border-gray-100 shadow-sm p-5 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                <CheckCircle2 size={20} />
              </div>
              <div className="text-[18px] font-black text-gray-900 leading-snug">
                ROI Optimization
              </div>
              <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
                Add an extra resource worker to eliminate queue bottleneck penalties and compare ROI.
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Cost Breakdown Chart ── */}
      <div className="rounded-[20px] bg-white border border-gray-100 shadow-sm p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#5742FF] flex items-center justify-center">
              <PieChartIcon size={16} />
            </div>
            <div>
              <span className="text-[14px] font-black text-gray-900 block">Cost Breakdown by Station</span>
              <span className="text-[11.5px] text-gray-400">Resource operating wages vs buffer inventory holding vs queue wait penalties</span>
            </div>
          </div>
        </div>

        <div className="w-full h-[290px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                formatter={(val: any) => [`$${Number(val || 0).toFixed(2)}`, ""]}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Bar dataKey="Resource Cost" stackId="a" fill="#5742FF" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Holding Cost" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Waiting Penalty" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Per-Station Breakdown Table ── */}
      <div className="rounded-[20px] bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[13px] font-black text-gray-900">Station Financial Summary</span>
          <span className="text-[11.5px] text-gray-400 font-medium">Auto-computed from simulation runtime</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Station Node</th>
                <th className="py-3 px-4 text-right">Resource Cost</th>
                <th className="py-3 px-4 text-right">Holding Cost</th>
                <th className="py-3 px-4 text-right">Waiting Penalty</th>
                <th className="py-3 px-4 text-right font-black text-gray-900">Total Station Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cost.breakdown.map((b) => (
                <tr key={b.nodeId} className="hover:bg-indigo-50/20 transition-colors">
                  <td className="py-3 px-4 font-bold text-gray-900">{b.nodeLabel}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-700">
                    {b.resourceCost > 0 ? `$${b.resourceCost.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-amber-600">
                    {b.holdingCost > 0 ? `$${b.holdingCost.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-rose-600">
                    {b.waitingPenalty > 0 ? `$${b.waitingPenalty.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-extrabold text-gray-900">
                    ${b.totalCost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50 font-black text-gray-900">
                <td className="py-3 px-4">Total System Cost</td>
                <td className="py-3 px-4 text-right">
                  ${cost.breakdown.reduce((sum, b) => sum + b.resourceCost, 0).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right text-amber-600">
                  ${cost.breakdown.reduce((sum, b) => sum + b.holdingCost, 0).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right text-rose-600">
                  ${cost.breakdown.reduce((sum, b) => sum + b.waitingPenalty, 0).toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right text-emerald-600 text-[14px]">
                  ${cost.totalSystemCost.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
