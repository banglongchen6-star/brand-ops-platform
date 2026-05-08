"use client";

// 月度规划表 —— 11 行类目 + 合计行
// 每行显示：类目 / 预算 / 平台 / 已/目 / 已花 / 要求
// hover 整行变浅紫，manager+ 点击进入 BudgetEditor

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export interface BudgetRow {
  category: string;
  shortName: string;
  budgetAmount: number;
  targetCount: number | null;
  platform: string;
  requirements: string;
  actualSpent: number;
  actualCount: number;
  gap: number;
  hasBudgetRecord: boolean;
}

export interface BudgetTotal {
  budget: number;
  target: number;
  spent: number;
  count: number;
  gap: number;
}

function fmtCNY(n: number, opts?: { wan?: boolean }): string {
  if (opts?.wan && Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(1).replace(/\.0$/, "") + " 万";
  }
  return "¥" + n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

export function BudgetTable({
  rows, total, canEdit, onRowClick,
}: {
  rows: BudgetRow[];
  total: BudgetTotal;
  canEdit: boolean;
  onRowClick: (row: BudgetRow) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition border-b border-gray-200"
      >
        <span className="text-xs font-medium text-gray-700">
          月度规划表
          <span className="text-gray-400 font-normal ml-2">
            · {rows.length} 个类目 · 预算 {fmtCNY(total.budget, { wan: true })} / 目标 {total.target} 条
          </span>
        </span>
        {collapsed ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "23%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "27%" }} />
            </colgroup>
            <thead>
              <tr className="text-xs text-gray-500 font-normal bg-white border-b border-gray-100">
                <th className="text-left px-3 py-2 font-normal">类目</th>
                <th className="text-right px-3 py-2 font-normal">预算</th>
                <th className="text-left px-3 py-2 font-normal">平台</th>
                <th className="text-center px-3 py-2 font-normal">已 / 目</th>
                <th className="text-right px-3 py-2 font-normal">已花</th>
                <th className="text-left px-3 py-2 font-normal">要求</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const overspent = r.gap < 0;
                const targetReached = r.targetCount != null && r.actualCount >= r.targetCount;
                return (
                  <tr
                    key={r.category}
                    onClick={() => canEdit && onRowClick(r)}
                    title={r.requirements || ""}
                    className={`border-b border-gray-50 last:border-b-0 transition ${
                      canEdit ? "cursor-pointer hover:bg-violet-50/50" : ""
                    } ${overspent ? "bg-amber-50/30" : ""}`}
                  >
                    <td className="px-3 py-2 text-gray-900 truncate">{r.category}</td>
                    <td className="px-3 py-2 text-right text-gray-700 tabular-nums">
                      {r.budgetAmount > 0 ? fmtCNY(r.budgetAmount, { wan: true }) : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 truncate">{r.platform || "—"}</td>
                    <td className={`px-3 py-2 text-center tabular-nums ${
                      targetReached ? "text-green-700 font-medium" : "text-gray-700"
                    }`}>
                      {r.actualCount}
                      {r.targetCount != null && <span className="text-gray-400"> / {r.targetCount}</span>}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${
                      overspent ? "text-amber-600 font-medium" : "text-gray-700"
                    }`}>
                      {r.actualSpent > 0 ? fmtCNY(r.actualSpent) : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs truncate">{r.requirements || "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                    暂无类目，先去 <a href="/dashboard/kol/schedule/settings" className="text-violet-700 hover:underline">字典管理</a> 添加
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/50 font-medium">
                  <td className="px-3 py-2 text-gray-900">合计</td>
                  <td className="px-3 py-2 text-right text-gray-900 tabular-nums">
                    {fmtCNY(total.budget, { wan: true })}
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-900">
                    {total.count}
                    {total.target > 0 && <span className="text-gray-400 font-normal"> / {total.target}</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                    {fmtCNY(total.spent)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {total.gap < 0 ? (
                      <span className="text-rose-600 font-medium">超支 {fmtCNY(Math.abs(total.gap))}</span>
                    ) : total.budget > 0 ? (
                      <span className="text-gray-500">缺口 {fmtCNY(total.gap)}</span>
                    ) : null}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
