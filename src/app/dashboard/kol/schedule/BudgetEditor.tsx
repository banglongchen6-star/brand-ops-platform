"use client";

// 编辑某个类目在 (year, month) 下的预算
// 写接口 PUT /api/schedule-budgets （manager+）

import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import type { BudgetRow } from "./BudgetTable";

export function BudgetEditor({
  year, month, row, onClose, onSaved,
}: {
  year: number;
  month: number;
  row: BudgetRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [budgetAmount, setBudgetAmount] = useState<string>(
    row.budgetAmount > 0 ? String(row.budgetAmount) : ""
  );
  const [budgetWan, setBudgetWan] = useState<string>(
    row.budgetAmount >= 10000 ? (row.budgetAmount / 10000).toFixed(2).replace(/\.?0+$/, "") : ""
  );
  const [targetCount, setTargetCount] = useState<string>(
    row.targetCount != null ? String(row.targetCount) : ""
  );
  const [platform, setPlatform] = useState<string>(row.platform || "");
  const [requirements, setRequirements] = useState<string>(row.requirements || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // 元 ↔ 万 双向同步
  function onBudgetYuan(v: string) {
    setBudgetAmount(v);
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) {
      setBudgetWan(n >= 10000 ? (n / 10000).toFixed(2).replace(/\.?0+$/, "") : "");
    } else {
      setBudgetWan("");
    }
  }
  function onBudgetWan(v: string) {
    setBudgetWan(v);
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) setBudgetAmount(String(Math.round(n * 10000)));
    else setBudgetAmount("");
  }

  async function save() {
    setErr("");
    const amt = Number(budgetAmount);
    if (!Number.isFinite(amt) || amt < 0) return setErr("预算必须为非负数字");
    if (targetCount && (!Number.isInteger(Number(targetCount)) || Number(targetCount) < 0)) {
      return setErr("目标条数必须为非负整数");
    }

    setSaving(true);
    const r = await fetch("/api/schedule-budgets", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year, month,
        category: row.category,
        budgetAmount: amt,
        targetCount: targetCount ? Number(targetCount) : null,
        platform: platform.trim(),
        requirements: requirements.trim(),
      }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) return setErr(j.error || "保存失败");
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">编辑预算</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{year} 年 {month} 月 · {row.category}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="预算（元）">
              <input
                type="number"
                value={budgetAmount}
                onChange={(e) => onBudgetYuan(e.target.value)}
                placeholder="0"
                min={0}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm tabular-nums"
              />
            </Field>
            <Field label="预算（万元，自动换算）">
              <input
                type="number"
                value={budgetWan}
                onChange={(e) => onBudgetWan(e.target.value)}
                placeholder="0"
                min={0}
                step="0.1"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm tabular-nums"
              />
            </Field>
          </div>

          <Field label="目标条数（留空表示不设目标）">
            <input
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              min={0}
              step={1}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm tabular-nums"
            />
          </Field>

          <Field label="平台">
            <input
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="如 抖音 / 抖音为主 / 全平台"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
            />
          </Field>

          <Field label="内容要求">
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              placeholder="如 1/弹奏 2/弹唱 3/单独鼓槌·产品特性体现"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
            />
          </Field>

          {err && <p className="text-xs text-rose-600">{err}</p>}

          {!row.hasBudgetRecord && (
            <p className="text-[11px] text-gray-400">
              当前月份还没设过该类目预算，保存后即建立记录。
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">取消</button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs hover:bg-violet-500 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
