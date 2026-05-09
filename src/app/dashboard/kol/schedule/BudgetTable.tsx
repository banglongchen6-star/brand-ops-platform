"use client";

// 月度规划表 —— 达人类型行 + 合计行
// 行 = schedule_directions 字典里的"达人类型"（弹唱/弹奏/鼓棒/生活/教学/亲子/种草/口播/测评/乐队/剧情/Vlog…）
// 单行包括：达人类型 / 平台 / 预算（万） / 数量 / 功能展示 / 要求 / 删除
// manager+ 直接点单元格内联编辑，行末垃圾桶停用类型，表底加"+ 添加达人类型"

import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface BudgetRow {
  categoryId: string | null;     // schedule_directions.id
  category: string;               // 达人类型 name
  shortName: string;
  budgetAmount: number;
  targetCount: number | null;
  platform: string;
  functionDisplay: string;
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

type EditableField = "budgetAmount" | "targetCount" | "platform" | "requirements" | "functionDisplay";

function fmtCNY(n: number, opts?: { wan?: boolean }): string {
  if (opts?.wan && Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(1).replace(/\.0$/, "") + " 万";
  }
  return "¥" + n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

export function BudgetTable({
  month, rows, total, canEdit, allDirectionEntries = [], onSave, onAdd, onRemove,
}: {
  month: number;
  rows: BudgetRow[];
  total: BudgetTotal;
  canEdit: boolean;
  // 字典里所有的达人类型（含已停用），用于"+ 添加"输入框的下拉建议
  allDirectionEntries?: { name: string; isActive: boolean }[];
  onSave: (category: string, field: EditableField, value: string | number | null) => Promise<void>;
  onAdd: (name: string) => Promise<void>;
  onRemove: (categoryId: string, categoryName: string, hasActuals: boolean) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingBusy, setAddingBusy] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  function startAdd() {
    setAdding(true); setNewName("");
    setTimeout(() => newInputRef.current?.focus(), 0);
  }
  async function commitAdd() {
    const name = newName.trim();
    if (!name) { setAdding(false); return; }
    setAddingBusy(true);
    try { await onAdd(name); setAdding(false); setNewName(""); }
    finally { setAddingBusy(false); }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition border-b border-gray-200"
      >
        <span className="text-xs font-medium text-gray-700">
          {month} 月 品宣规划表
          <span className="text-gray-400 font-normal ml-2">
            · {rows.length} 个达人类型 · 预算 {fmtCNY(total.budget, { wan: true })} / 目标 {total.target} 条
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
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "4%" }} />
            </colgroup>
            <thead>
              <tr className="text-xs text-gray-500 font-normal bg-white border-b border-gray-100">
                <th className="text-left px-3 py-2 font-normal">达人类型</th>
                <th className="text-left px-3 py-2 font-normal">平台</th>
                <th className="text-right px-3 py-2 font-normal">预算（万）</th>
                <th className="text-center px-3 py-2 font-normal">数量</th>
                <th className="text-left px-3 py-2 font-normal">功能展示</th>
                <th className="text-left px-3 py-2 font-normal">要求</th>
                <th className="px-1 py-2 font-normal text-center text-gray-300">{canEdit ? "删除" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const overspent = r.gap < 0;
                const isOrphan = !r.categoryId;
                return (
                  <tr
                    key={r.category}
                    title={isOrphan ? `「${r.category}」未在字典 · 点击右侧 + 加入` : (r.requirements || "")}
                    className={`group border-b border-gray-50 last:border-b-0 ${overspent ? "bg-amber-50/30" : ""} ${isOrphan ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-3 py-2 text-gray-900 truncate">
                      {r.category}
                      {isOrphan && <span className="ml-1 text-[9px] text-amber-700 align-middle">未在字典</span>}
                    </td>

                    <td className="px-1 py-1">
                      <TextCell
                        canEdit={canEdit} value={r.platform} placeholder="—" align="left"
                        onSave={(v) => onSave(r.category, "platform", v)}
                      />
                    </td>

                    <td className="px-1 py-1 text-right tabular-nums">
                      <BudgetCell
                        canEdit={canEdit} value={r.budgetAmount}
                        onSave={(v) => onSave(r.category, "budgetAmount", v)}
                      />
                    </td>

                    <td className="px-1 py-1 text-center tabular-nums text-gray-700">
                      {r.actualCount}
                    </td>

                    <td className="px-1 py-1 text-xs">
                      <TextCell
                        canEdit={canEdit} value={r.functionDisplay} placeholder="—" align="left"
                        onSave={(v) => onSave(r.category, "functionDisplay", v)}
                      />
                    </td>

                    <td className="px-1 py-1 text-xs">
                      <TextCell
                        canEdit={canEdit} value={r.requirements} placeholder="—" align="left"
                        onSave={(v) => onSave(r.category, "requirements", v)}
                      />
                    </td>

                    <td className="px-1 py-1 text-center">
                      {canEdit && r.categoryId && (
                        <button
                          onClick={() => onRemove(r.categoryId!, r.category, r.actualCount > 0 || r.budgetAmount > 0)}
                          className="text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded p-1 inline-flex items-center justify-center transition"
                          title={`停用达人类型「${r.category}」`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      {canEdit && !r.categoryId && (
                        <button
                          onClick={() => onAdd(r.category)}
                          className="text-violet-500 hover:text-violet-700 hover:bg-violet-50 rounded p-1 inline-flex items-center justify-center transition"
                          title={`「${r.category}」未在字典 · 点击加入并启用`}
                        >
                          <Plus size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && !canEdit && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-400">
                    暂无达人类型
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/50 font-medium">
                  <td className="px-3 py-2 text-gray-900">合计</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right text-gray-900 tabular-nums">
                    {(total.budget / 10000).toFixed(1).replace(/\.0$/, "") || "0"}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-900">
                    {total.count}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {total.gap < 0 ? (
                      <span className="text-rose-600 font-medium">超支 {fmtCNY(Math.abs(total.gap))}</span>
                    ) : total.budget > 0 ? (
                      <span className="text-gray-500">缺口 {fmtCNY(total.gap)}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-1 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* 添加达人类型 —— 放在 table 外，避免 overflow 裁切下拉浮层 */}
      {!collapsed && canEdit && (
        <div className="px-3 py-2 border-t border-gray-100">
          {!adding ? (
            <button onClick={startAdd}
              className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1">
              <Plus size={12} /> 添加达人类型
            </button>
          ) : (
            <AddDirectionRow
              inputRef={newInputRef}
              value={newName}
              onChange={setNewName}
              allEntries={allDirectionEntries}
              busy={addingBusy}
              onCommit={async (picked) => {
                if (picked != null) {
                  setNewName(picked);
                  setAddingBusy(true);
                  try { await onAdd(picked); setAdding(false); setNewName(""); }
                  finally { setAddingBusy(false); }
                } else {
                  commitAdd();
                }
              }}
              onCancel={() => { setAdding(false); setNewName(""); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────── Editable Cells ───────────────────────────────────────────

function BudgetCell({
  canEdit, value, onSave,
}: {
  canEdit: boolean;
  value: number;
  onSave: (yuan: number) => Promise<void>;
}) {
  const wan = value > 0 ? (value / 10000).toFixed(2).replace(/\.?0+$/, "") : "";
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(wan);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setInput(wan); }, [wan, editing]);

  function start() {
    if (!canEdit) return;
    setEditing(true); setInput(wan);
    setTimeout(() => ref.current?.select(), 0);
  }
  async function commit() {
    if (!editing) return;
    setEditing(false);
    const trimmed = input.trim();
    const newWan = trimmed === "" ? 0 : Number(trimmed);
    if (!Number.isFinite(newWan) || newWan < 0) return;
    const newYuan = Math.round(newWan * 10000);
    if (newYuan === value) return;
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

// ─────────────────────────────────────────── Add Direction Row ───────────────────────────────────────────

function AddDirectionRow({
  inputRef, value, onChange, allEntries, busy, onCommit, onCancel,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  allEntries: { name: string; isActive: boolean }[];
  busy: boolean;
  onCommit: (picked: string | null) => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const trimmed = value.trim();
  const filtered = trimmed
    ? allEntries.filter((e) => e.name.toLowerCase().includes(trimmed.toLowerCase()))
    : allEntries;
  const exactMatch = trimmed && allEntries.some((e) => e.name === trimmed);

  return (
    <div className="flex items-center gap-2" ref={wrapperRef}>
      <div className="relative flex-1 max-w-md">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onCommit(null); }
            else if (e.key === "Escape") { setOpen(false); onCancel(); }
          }}
          placeholder={allEntries.length > 0
            ? "点开看字典里的达人类型 · 或输入新名称…"
            : "新达人类型名（如：合唱、舞蹈、料理…）"}
          className="w-full px-2 py-1 border border-violet-400 rounded text-sm outline-none"
        />

        {open && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-auto">
            {filtered.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-100 bg-gray-50/60">
                  字典里的达人类型 · 点击直接添加 / 启用
                </div>
                {filtered.map((it) => (
                  <button
                    key={it.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setOpen(false); onCommit(it.name); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 flex items-center justify-between"
                  >
                    <span className="text-gray-900">{it.name}</span>
                    <span className={`text-[10px] ${it.isActive ? "text-green-600" : "text-gray-400"}`}>
                      {it.isActive ? "已在表里" : "已停用"}
                    </span>
                  </button>
                ))}
              </>
            )}
            {filtered.length === 0 && allEntries.length === 0 && !trimmed && (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                字典里没有任何达人类型 · 直接输入新名称即可创建
              </div>
            )}
            {filtered.length === 0 && allEntries.length > 0 && trimmed && (
              <div className="px-3 py-2 text-xs text-gray-400">无匹配 · 可创建新类型</div>
            )}
            {trimmed && !exactMatch && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setOpen(false); onCommit(null); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 ${
                  filtered.length > 0 ? "border-t border-gray-100" : ""
                } text-violet-700 inline-flex items-center gap-1`}
              >
                <Plus size={12} /> 新建「{trimmed}」
              </button>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => onCommit(null)}
        disabled={busy || !value.trim()}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-violet-600 text-white text-xs disabled:opacity-50 hover:bg-violet-500"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
        添加
      </button>
      <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-700">
        <X size={14} />
      </button>
      <span className="text-[10px] text-gray-400">
        {allEntries.length > 0
          ? `字典里有 ${allEntries.length} 个类型 · 点选即可`
          : "新建后在表里直接填预算/平台/要求"}
      </span>
    </div>
  );
}

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
