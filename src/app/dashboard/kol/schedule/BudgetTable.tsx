"use client";

// 月度规划表 —— 11 行类目 + 合计行
// manager+ 直接点单元格内联编辑（点击 → 输入框 → Enter/失焦保存，Esc 取消）
// 4 个可编辑字段：
//   - budgetAmount  以"万元"为输入单位，存储仍用"元"
//   - targetCount   非负整数，留空 = 不设目标
//   - platform      自由文本
//   - requirements  自由文本
// 已花 / 已/目 的实际值是计算列，只读。

import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface BudgetRow {
  categoryId: string | null;
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

type EditableField = "budgetAmount" | "targetCount" | "platform" | "requirements";

function fmtCNY(n: number, opts?: { wan?: boolean }): string {
  if (opts?.wan && Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(1).replace(/\.0$/, "") + " 万";
  }
  return "¥" + n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

export function BudgetTable({
  rows, total, canEdit, onSave, onAdd, onRemove,
}: {
  rows: BudgetRow[];
  total: BudgetTotal;
  canEdit: boolean;
  // 单字段保存：父组件负责调 PUT；返回 Promise 以便子组件知道何时结束
  onSave: (category: string, field: EditableField, value: string | number | null) => Promise<void>;
  // 新增类目（写到字典）
  onAdd: (name: string) => Promise<void>;
  // 删除类目（软删除字典里的类目；已有排期记录不动）
  onRemove: (categoryId: string, categoryName: string, hasActuals: boolean) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingBusy, setAddingBusy] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  function startAdd() {
    setAdding(true);
    setNewName("");
    setTimeout(() => newInputRef.current?.focus(), 0);
  }
  async function commitAdd() {
    const name = newName.trim();
    if (!name) { setAdding(false); return; }
    setAddingBusy(true);
    try {
      await onAdd(name);
      setAdding(false); setNewName("");
    } finally {
      setAddingBusy(false);
    }
  }

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
          {canEdit && (
            <span className="text-violet-500 font-normal ml-2 text-[10px]">点单元格直接编辑</span>
          )}
        </span>
        {collapsed ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "27%" }} />
              <col style={{ width: "4%" }} />
            </colgroup>
            <thead>
              <tr className="text-xs text-gray-500 font-normal bg-white border-b border-gray-100">
                <th className="text-left px-3 py-2 font-normal">类目</th>
                <th className="text-right px-3 py-2 font-normal">预算（万）</th>
                <th className="text-left px-3 py-2 font-normal">平台</th>
                <th className="text-center px-3 py-2 font-normal">已 / 目</th>
                <th className="text-right px-3 py-2 font-normal">已花</th>
                <th className="text-left px-3 py-2 font-normal">要求</th>
                <th className="px-1 py-2 font-normal text-center text-gray-300">{canEdit ? "删除" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const overspent = r.gap < 0;
                const targetReached = r.targetCount != null && r.actualCount >= r.targetCount;
                return (
                  <tr
                    key={r.category}
                    title={r.requirements || ""}
                    className={`group border-b border-gray-50 last:border-b-0 ${overspent ? "bg-amber-50/30" : ""}`}
                  >
                    <td className="px-3 py-2 text-gray-900 truncate">{r.category}</td>

                    {/* 预算（万元） */}
                    <td className="px-1 py-1 text-right tabular-nums">
                      <BudgetCell
                        canEdit={canEdit}
                        value={r.budgetAmount}
                        onSave={(v) => onSave(r.category, "budgetAmount", v)}
                      />
                    </td>

                    {/* 平台 */}
                    <td className="px-1 py-1">
                      <TextCell
                        canEdit={canEdit}
                        value={r.platform}
                        placeholder="—"
                        align="left"
                        onSave={(v) => onSave(r.category, "platform", v)}
                      />
                    </td>

                    {/* 已/目（已实际只读 + 目标可编辑） */}
                    <td className={`px-1 py-1 text-center tabular-nums ${
                      targetReached ? "text-green-700 font-medium" : "text-gray-700"
                    }`}>
                      <span>{r.actualCount}</span>
                      <span className="text-gray-400"> / </span>
                      <TargetCell
                        canEdit={canEdit}
                        value={r.targetCount}
                        onSave={(v) => onSave(r.category, "targetCount", v)}
                      />
                    </td>

                    {/* 已花（只读） */}
                    <td className={`px-3 py-2 text-right tabular-nums ${
                      overspent ? "text-amber-600 font-medium" : "text-gray-700"
                    }`}>
                      {r.actualSpent > 0 ? fmtCNY(r.actualSpent) : "—"}
                    </td>

                    {/* 要求 */}
                    <td className="px-1 py-1 text-xs">
                      <TextCell
                        canEdit={canEdit}
                        value={r.requirements}
                        placeholder="—"
                        align="left"
                        onSave={(v) => onSave(r.category, "requirements", v)}
                      />
                    </td>

                    {/* 删除按钮 —— 始终可见，淡灰色，悬停变红 */}
                    <td className="px-1 py-1 text-center">
                      {canEdit && r.categoryId && (
                        <button
                          onClick={() => onRemove(r.categoryId!, r.category, r.actualCount > 0 || r.budgetAmount > 0)}
                          className="text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded p-1 inline-flex items-center justify-center transition"
                          title={`删除类目「${r.category}」`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* + 添加类目 */}
              {canEdit && (
                <tr className="border-b border-gray-50">
                  <td colSpan={7} className="px-3 py-2">
                    {!adding ? (
                      <button
                        onClick={startAdd}
                        className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus size={12} /> 添加类目
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          ref={newInputRef}
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitAdd(); }
                            else if (e.key === "Escape") { setAdding(false); setNewName(""); }
                          }}
                          placeholder="新类目名（如：尾部弹奏弹唱）"
                          className="flex-1 max-w-md px-2 py-1 border border-violet-400 rounded text-sm outline-none"
                        />
                        <button
                          onClick={commitAdd}
                          disabled={addingBusy || !newName.trim()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-violet-600 text-white text-xs disabled:opacity-50 hover:bg-violet-500"
                        >
                          {addingBusy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                          添加
                        </button>
                        <button
                          onClick={() => { setAdding(false); setNewName(""); }}
                          className="p-1 text-gray-400 hover:text-gray-700"
                        >
                          <X size={14} />
                        </button>
                        <span className="text-[10px] text-gray-400">
                          仅创建类目；预算/平台/要求添加后在表中直接填即可
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              )}

              {rows.length === 0 && !canEdit && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-400">
                    暂无类目
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/50 font-medium">
                  <td className="px-3 py-2 text-gray-900">合计</td>
                  <td className="px-3 py-2 text-right text-gray-900 tabular-nums">
                    {(total.budget / 10000).toFixed(1).replace(/\.0$/, "") || "0"}
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
                  <td className="px-1 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────── Editable Cells ───────────────────────────────────────────

// 预算单元格：显示"X 万"，编辑时输入万元
function BudgetCell({
  canEdit, value, onSave,
}: {
  canEdit: boolean;
  value: number;          // 元
  onSave: (yuan: number) => Promise<void>;
}) {
  const wan = value > 0 ? (value / 10000).toFixed(2).replace(/\.?0+$/, "") : "";
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(wan);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // 外部值变了同步（避免父刷新后输入框还显示老值）
  useEffect(() => { if (!editing) setInput(wan); }, [wan, editing]);

  function start() {
    if (!canEdit) return;
    setEditing(true);
    setInput(wan);
    setTimeout(() => ref.current?.select(), 0);
  }
  async function commit() {
    if (!editing) return;
    setEditing(false);
    const trimmed = input.trim();
    const newWan = trimmed === "" ? 0 : Number(trimmed);
    if (!Number.isFinite(newWan) || newWan < 0) return; // 静默忽略非法
    const newYuan = Math.round(newWan * 10000);
    if (newYuan === value) return; // 没变
    setSaving(true);
    try { await onSave(newYuan); } finally { setSaving(false); }
  }
  function cancel() { setEditing(false); setInput(wan); }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number" min={0} step="0.1"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className="w-full px-2 py-1 border border-violet-400 rounded text-sm tabular-nums text-right outline-none bg-white"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={!canEdit}
      className={`w-full px-2 py-1 rounded text-right tabular-nums ${
        canEdit ? "hover:bg-violet-50 hover:ring-1 hover:ring-violet-200 cursor-text" : "cursor-default"
      } ${saving ? "opacity-60" : ""}`}
    >
      {value > 0 ? wan : <span className="text-gray-400">—</span>}
      {saving && <Loader2 size={10} className="inline-block ml-1 animate-spin text-gray-400" />}
    </button>
  );
}

// 目标条数：行内 inline 数字
function TargetCell({
  canEdit, value, onSave,
}: {
  canEdit: boolean;
  value: number | null;
  onSave: (n: number | null) => Promise<void>;
}) {
  const display = value == null ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(display);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setInput(display); }, [display, editing]);

  function start() {
    if (!canEdit) return;
    setEditing(true); setInput(display);
    setTimeout(() => ref.current?.select(), 0);
  }
  async function commit() {
    if (!editing) return;
    setEditing(false);
    const trimmed = input.trim();
    if (trimmed === "") {
      if (value == null) return;
      setSaving(true);
      try { await onSave(null); } finally { setSaving(false); }
      return;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0) return;
    if (n === value) return;
    setSaving(true);
    try { await onSave(n); } finally { setSaving(false); }
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number" min={0} step={1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { e.preventDefault(); setEditing(false); setInput(display); }
        }}
        className="inline-block w-12 px-1 py-0.5 border border-violet-400 rounded text-center tabular-nums outline-none bg-white"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={!canEdit}
      className={`inline-block min-w-[1.5em] px-1 rounded ${
        canEdit ? "hover:bg-violet-50 hover:ring-1 hover:ring-violet-200 cursor-text" : "cursor-default"
      } ${saving ? "opacity-60" : ""}`}
    >
      {value == null ? <span className="text-gray-400">—</span> : value}
      {saving && <Loader2 size={10} className="inline-block ml-1 animate-spin text-gray-400" />}
    </button>
  );
}

// 通用文本单元格：平台 / 要求
function TextCell({
  canEdit, value, placeholder, align, onSave,
}: {
  canEdit: boolean;
  value: string;
  placeholder: string;
  align: "left" | "center";
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setInput(value); }, [value, editing]);

  function start() {
    if (!canEdit) return;
    setEditing(true); setInput(value);
    setTimeout(() => ref.current?.select(), 0);
  }
  async function commit() {
    if (!editing) return;
    setEditing(false);
    const v = input.trim();
    if (v === value) return;
    setSaving(true);
    try { await onSave(v); } finally { setSaving(false); }
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          else if (e.key === "Escape") { e.preventDefault(); setEditing(false); setInput(value); }
        }}
        className={`w-full px-2 py-1 border border-violet-400 rounded text-sm outline-none bg-white ${
          align === "center" ? "text-center" : "text-left"
        }`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={!canEdit}
      title={value || ""}
      className={`w-full px-2 py-1 rounded truncate text-${align} ${
        canEdit ? "hover:bg-violet-50 hover:ring-1 hover:ring-violet-200 cursor-text" : "cursor-default"
      } ${saving ? "opacity-60" : ""}`}
    >
      {value || <span className="text-gray-400">{placeholder}</span>}
      {saving && <Loader2 size={10} className="inline-block ml-1 animate-spin text-gray-400" />}
    </button>
  );
}
