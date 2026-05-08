"use client";

// 达人排期表 · 月历主页（M1）
// 路径：/dashboard/kol/schedule
// M1 范围：月份切换 + 月历视图 + 单条新增/编辑/删除（达人名手填）
// M2 再做：达人选择器、Excel 导入导出、筛选弹窗
// M3 再做：顶部规划表 + 4 个统计卡片

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Plus, Settings as SettingsIcon,
  Loader2, X, Save, Trash2, ExternalLink, Filter, Upload, Download, Copy,
} from "lucide-react";
import { KolSelector } from "@/components/kol/KolSelector";
import { ImportWizard } from "./ImportWizard";
import { FilterDialog } from "./FilterDialog";
import { BudgetTable, type BudgetRow, type BudgetTotal } from "./BudgetTable";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { supabase } from "@/lib/supabase";

interface ItemDTO {
  id: string;
  kolName: string;
  kolId: string | null;
  amount: number;
  category: string;
  categoryShort: string;
  categoryDirection: string;
  tier: string;
  platform: string;
  status: string;
  publishUrl: string;
  publishDate: string | null;
  notes: string;
}
interface DayCell {
  date: string;
  weekday: number;
  items: ItemDTO[];
  isCurrentMonth: boolean;
}
interface WeekRow {
  weekNum: number;
  days: DayCell[];
  weekTotal: number;
}
interface MonthData {
  year: number;
  month: number;
  weeks: WeekRow[];
  monthTotal: number;
  totalCount: number;
}

interface Direction { id: string; name: string; is_active: boolean; sort_order?: number }

const TIERS = ["头部", "中部", "腰部", "尾部", "素人"] as const;
const STATUS_LABEL: Record<string, string> = {
  planned: "计划中",
  contacted: "已联系",
  confirmed: "已确认",
  published: "已发布",
  settled: "已结算",
  cancelled: "已取消",
};
const STATUS_TEXT_COLOR: Record<string, string> = {
  planned: "text-gray-500",
  contacted: "text-amber-700",
  confirmed: "text-blue-700",
  published: "text-violet-700",
  settled: "text-green-700",
  cancelled: "text-gray-400 line-through",
};

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function fmtCNY(n: number): string {
  if (!n) return "¥0";
  return "¥" + n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prevMonthLabel(year: number, month: number): string {
  let y = year, m = month - 1;
  if (m < 1) { m = 12; y -= 1; }
  return `${y} 年 ${m} 月`;
}

function nextMonthOf(year: number, month: number): { y: number; m: number } {
  let y = year, m = month + 1;
  if (m > 12) { m = 1; y += 1; }
  return { y, m };
}

export default function SchedulePage() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [data, setData] = useState<MonthData | null>(null);
  const [dataNext, setDataNext] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [directions, setDirections] = useState<Direction[]>([]);
  const [allDirections, setAllDirections] = useState<Direction[]>([]); // 含已停用，用于规划表的"+ 添加"自动补全

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<ItemDTO | null>(null);
  const [editorDate, setEditorDate] = useState<string>(todayYMD());

  // 筛选 + 导入
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterTiers, setFilterTiers] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  // 月度规划表（按"达人类型"分组）
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [budgetTotal, setBudgetTotal] = useState<BudgetTotal>({ budget: 0, target: 0, spent: 0, count: 0, gap: 0 });
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [copyingBudget, setCopyingBudget] = useState(false);

  const isAdmin = useIsAdmin();
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setRole(""); return; }
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setRole(data?.role ?? "");
    })();
  }, []);
  const canEditBudget = isAdmin === true || role === "manager";

  async function fetchMonth(y: number, m: number, cats: string[], tiers: string[]): Promise<MonthData | null> {
    const params = new URLSearchParams({ year: String(y), month: String(m) });
    if (cats.length) params.set("categories", cats.join(","));
    if (tiers.length) params.set("tiers", tiers.join(","));
    try {
      const r = await fetch(`/api/kol-schedules?${params.toString()}`);
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "加载失败");
        return null;
      }
      return j as MonthData;
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
      return null;
    }
  }

  async function loadData(y: number, m: number, tiers = filterTiers) {
    setLoading(true); setError("");
    const { y: ny, m: nm } = nextMonthOf(y, m);
    const [a, b] = await Promise.all([
      fetchMonth(y, m, [], tiers),
      fetchMonth(ny, nm, [], tiers),
    ]);
    setData(a);
    setDataNext(b);
    setLoading(false);
  }

  function exportExcel() {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (filterTiers.length) params.set("tiers", filterTiers.join(","));
    window.location.href = `/api/kol-schedules/export?${params.toString()}`;
  }

  async function loadDicts() {
    const r = await fetch("/api/schedule-directions");
    const j = await r.json();
    if (r.ok) {
      const items = (j.items || []) as Direction[];
      setAllDirections(items);
      setDirections(items.filter((d) => d.is_active));
    }
  }

  async function loadBudgets(y: number, m: number) {
    setBudgetLoading(true);
    try {
      const r = await fetch(`/api/schedule-budgets?year=${y}&month=${m}`);
      const j = await r.json();
      if (r.ok) {
        setBudgetRows(j.rows || []);
        setBudgetTotal(j.total || { budget: 0, target: 0, spent: 0, count: 0, gap: 0 });
      }
    } finally {
      setBudgetLoading(false);
    }
  }

  // 内联保存预算字段：乐观更新 + 失败回滚
  async function saveBudgetField(
    category: string,
    field: "budgetAmount" | "targetCount" | "platform" | "requirements" | "functionDisplay",
    value: string | number | null
  ) {
    const prevRows = budgetRows;
    const prevTotal = budgetTotal;
    const newRows = budgetRows.map((r) => {
      if (r.category !== category) return r;
      const next = { ...r, hasBudgetRecord: true };
      if (field === "budgetAmount")    next.budgetAmount = Number(value) || 0;
      if (field === "targetCount")     next.targetCount = value == null ? null : Number(value);
      if (field === "platform")        next.platform = String(value ?? "");
      if (field === "requirements")    next.requirements = String(value ?? "");
      if (field === "functionDisplay") next.functionDisplay = String(value ?? "");
      next.gap = next.budgetAmount - next.actualSpent;
      return next;
    });
    setBudgetRows(newRows);
    if (field === "budgetAmount") {
      const newBudget = newRows.reduce((a, r) => a + r.budgetAmount, 0);
      setBudgetTotal((t) => ({ ...t, budget: newBudget, gap: newBudget - t.spent }));
    } else if (field === "targetCount") {
      const newTarget = newRows.reduce((a, r) => a + (r.targetCount ?? 0), 0);
      setBudgetTotal((t) => ({ ...t, target: newTarget }));
    }

    try {
      const r = await fetch("/api/schedule-budgets", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, category, [field]: value }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "保存失败");
      }
    } catch (e) {
      setBudgetRows(prevRows);
      setBudgetTotal(prevTotal);
      alert(e instanceof Error ? e.message : "保存失败");
    }
  }

  // 在规划表里直接新增/启用"达人类型"
  // 智能处理：
  //   - 字典里已存在 + 已激活 → 已经在表里了，提示
  //   - 字典里已存在 + 已停用 → PATCH 重新启用
  //   - 字典里没有 → POST 新建
  async function addBudgetDirection(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = allDirections.find((d) => d.name === trimmed);
    if (existing && existing.is_active) {
      alert(`「${trimmed}」已经在规划表里了`);
      return;
    }
    if (existing && !existing.is_active) {
      const r = await fetch(`/api/schedule-directions/${existing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error || "启用失败"); return; }
    } else {
      const sortOrder = (allDirections[allDirections.length - 1]?.sort_order ?? 0) + 1;
      const r = await fetch("/api/schedule-directions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, sort_order: sortOrder }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error || "添加失败"); return; }
    }
    await Promise.all([loadDicts(), loadBudgets(year, month)]);
  }

  async function removeBudgetDirection(directionId: string, name: string, hasActuals: boolean) {
    const warn = hasActuals
      ? `达人类型「${name}」当月已有预算或排期，停用后字典里不再显示，但已有数据保留。\n\n确认停用？`
      : `停用达人类型「${name}」？字典里不再显示，已有数据不受影响。`;
    if (!confirm(warn)) return;
    const r = await fetch(`/api/schedule-directions/${directionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error || "停用失败"); return; }
    await Promise.all([loadDicts(), loadBudgets(year, month)]);
  }

  async function copyFromLastMonth() {
    if (!confirm(`从上月（${prevMonthLabel(year, month)}）复制预算到 ${year} 年 ${month} 月？已设置过的类型会保留不动。`)) return;
    setCopyingBudget(true);
    const r = await fetch("/api/schedule-budgets/copy-from-last-month", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    const j = await r.json();
    setCopyingBudget(false);
    if (!r.ok) { alert(j.error || "复制失败"); return; }
    if (j.copied === 0 && j.skipped === 0) { alert(j.message || "上月没有预算可复制"); return; }
    alert(`复制完成：新增 ${j.copied} 条，跳过已存在的 ${j.skipped} 条`);
    loadBudgets(year, month);
  }

  useEffect(() => { loadDicts(); }, []);
  useEffect(() => { loadData(year, month); loadBudgets(year, month); }, [year, month]);

  async function reloadAll() {
    await Promise.all([loadData(year, month), loadBudgets(year, month)]);
  }

  function shift(delta: -1 | 1) {
    let y = year; let m = month + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setYear(y); setMonth(m);
  }
  function gotoToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }

  function openCreate(date: string) {
    setEditorItem(null);
    setEditorDate(date);
    setEditorOpen(true);
  }
  function openEdit(item: ItemDTO, date: string) {
    setEditorItem(item);
    setEditorDate(date);
    setEditorOpen(true);
  }

  return (
    <>
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)}
            className="w-8 h-8 rounded-md border border-gray-200 hover:bg-gray-50 inline-flex items-center justify-center text-gray-600">
            <ChevronLeft size={16} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 tabular-nums min-w-[120px] text-center">
            {year} 年 {month} 月
          </h1>
          <button onClick={() => shift(1)}
            className="w-8 h-8 rounded-md border border-gray-200 hover:bg-gray-50 inline-flex items-center justify-center text-gray-600">
            <ChevronRight size={16} />
          </button>
          <button onClick={gotoToday}
            className="ml-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-md">
            今天
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterOpen(true)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md ${
              filterTiers.length
                ? "border-violet-500 bg-violet-50 text-violet-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter size={14} /> 筛选
            {filterTiers.length > 0 && (
              <span className="ml-1 text-[10px] tabular-nums">
                · {filterTiers.length}
              </span>
            )}
          </button>
          <button onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
            <Upload size={14} /> 导入
          </button>
          <button onClick={exportExcel}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
            <Download size={14} /> 导出
          </button>
          <Link href="/dashboard/kol/schedule/settings"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
            <SettingsIcon size={14} /> 字典管理
          </Link>
          <button onClick={() => openCreate(todayYMD().slice(0, 7) === `${year}-${String(month).padStart(2, "0")}` ? todayYMD() : `${year}-${String(month).padStart(2, "0")}-01`)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs hover:bg-violet-500">
            <Plus size={14} /> 新增排期
          </button>
        </div>
      </div>

      {/* 月度规划表（按达人类型分组）+ 复制上月按钮 */}
      <div className="flex items-center justify-end gap-2 mb-2">
        {canEditBudget && (
          <button onClick={copyFromLastMonth} disabled={copyingBudget}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">
            {copyingBudget ? <Loader2 size={11} className="animate-spin" /> : <Copy size={11} />}
            从 {prevMonthLabel(year, month)} 复制预算
          </button>
        )}
      </div>
      {budgetLoading ? (
        <div className="py-6 text-center text-sm text-gray-400 inline-flex items-center justify-center gap-2 w-full">
          <Loader2 size={14} className="animate-spin" /> 月度规划加载中…
        </div>
      ) : (
        <BudgetTable
          month={month}
          rows={budgetRows}
          total={budgetTotal}
          canEdit={canEditBudget}
          inactiveDirectionNames={allDirections.filter((d) => !d.is_active).map((d) => d.name)}
          onSave={saveBudgetField}
          onAdd={addBudgetDirection}
          onRemove={removeBudgetDirection}
        />
      )}

      {/* 月历主体 */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400 inline-flex items-center justify-center gap-2 w-full">
          <Loader2 size={16} className="animate-spin" /> 加载中…
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-rose-600">{error}</div>
      ) : (
        <div className="space-y-4">
          {data && (
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-sm font-semibold text-gray-900 tabular-nums">
                  {data.year} 年 {data.month} 月
                </h2>
                <span className="text-[11px] text-gray-400">
                  共 {data.totalCount} 条 · ¥{data.monthTotal.toLocaleString("zh-CN")}
                </span>
              </div>
              <CalendarGrid
                data={data}
                onCellClick={(date) => openCreate(date)}
                onItemClick={(item, date) => openEdit(item, date)}
              />
            </div>
          )}
          {dataNext && (
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-sm font-semibold text-gray-900 tabular-nums">
                  {dataNext.year} 年 {dataNext.month} 月
                </h2>
                <span className="text-[11px] text-gray-400">
                  共 {dataNext.totalCount} 条 · ¥{dataNext.monthTotal.toLocaleString("zh-CN")}
                </span>
              </div>
              <CalendarGrid
                data={dataNext}
                onCellClick={(date) => openCreate(date)}
                onItemClick={(item, date) => openEdit(item, date)}
              />
            </div>
          )}
        </div>
      )}

      {editorOpen && (
        <ScheduleEditor
          item={editorItem}
          defaultDate={editorDate}
          directions={directions}
          onClose={() => setEditorOpen(false)}
          onSaved={() => { setEditorOpen(false); reloadAll(); }}
        />
      )}

      {filterOpen && (
        <FilterDialog
          initialSelectedTiers={filterTiers}
          onClose={() => setFilterOpen(false)}
          onApply={(tiers) => {
            setFilterTiers(tiers);
            setFilterOpen(false);
            loadData(year, month, tiers);
          }}
          onReset={() => {
            setFilterTiers([]);
            setFilterOpen(false);
            loadData(year, month, []);
          }}
        />
      )}

      {importOpen && (
        <ImportWizard
          onClose={() => setImportOpen(false)}
          onCompleted={() => { setImportOpen(false); reloadAll(); }}
        />
      )}
    </>
  );
}

// ───────────────────────────────────────── Calendar Grid ─────────────────────────────────────────

function CalendarGrid({
  data, onCellClick, onItemClick,
}: {
  data: MonthData;
  onCellClick: (date: string) => void;
  onItemClick: (item: ItemDTO, date: string) => void;
}) {
  const today = todayYMD();
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* 表头 周一→周日 */}
      <div className="grid grid-cols-7 bg-gray-50 text-center text-[11px] text-gray-500 font-medium border-b border-gray-200">
        {WEEK_LABELS.map((w, i) => (
          <div key={i} className="py-2">周{w}</div>
        ))}
      </div>

      {data.weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
          {week.days.map((day) => {
            const isToday = day.date === today;
            return (
              <div
                key={day.date}
                onClick={() => onCellClick(day.date)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCellClick(day.date); }
                }}
                className={`min-h-[110px] border-r border-gray-100 last:border-r-0 p-1.5 group relative cursor-pointer transition
                  ${day.isCurrentMonth ? "bg-white hover:bg-violet-50/40" : "bg-gray-50/60 hover:bg-gray-100"}
                  ${isToday ? "bg-violet-50/60" : ""}`}
                title="点空白处新增排期"
              >
                {/* 日期标头 */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] tabular-nums inline-flex items-center gap-1 ${day.isCurrentMonth ? "text-gray-700" : "text-gray-400"} ${isToday ? "text-violet-700 font-semibold" : ""}`}>
                    {Number(day.date.slice(8, 10))}
                    {isToday && <span className="text-[9px] bg-violet-600 text-white rounded px-1 leading-none py-[1px]">今</span>}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 transition text-gray-300 inline-flex items-center justify-center">
                    <Plus size={12} />
                  </span>
                </div>

                {/* 排期卡片 —— 点击事件需要 stopPropagation 避免触发 cell 的新增 */}
                {day.items.slice(0, 2).map((item) => (
                  <ItemCard
                    key={item.id} item={item}
                    onClick={(e) => { e.stopPropagation(); onItemClick(item, day.date); }}
                  />
                ))}
                {day.items.length > 2 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onItemClick(day.items[2], day.date); }}
                    className="text-[10px] text-gray-500 hover:text-violet-700 ml-1"
                  >
                    + {day.items.length - 2} 条
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ItemCard({ item, onClick }: { item: ItemDTO; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-50 hover:bg-violet-50/60 border border-gray-200 rounded-md p-1.5 mb-1 transition"
    >
      <div className="text-[11px] font-medium text-gray-900 truncate">{item.kolName}</div>
      <div className="flex justify-between items-baseline">
        <span className={`text-[11px] tabular-nums ${STATUS_TEXT_COLOR[item.status] ?? ""}`}>
          {fmtCNY(item.amount)}
        </span>
        {item.tier && <span className="text-[10px] text-gray-400">{item.tier}</span>}
      </div>
      <div className="text-[10px] text-gray-500 truncate">
        {item.categoryDirection || "—"}
        {item.platform ? ` · ${item.platform}` : ""}
      </div>
    </button>
  );
}

// ───────────────────────────────────────── Editor Drawer ─────────────────────────────────────────

function ScheduleEditor({
  item, defaultDate, directions, onClose, onSaved,
}: {
  item: ItemDTO | null;
  defaultDate: string;
  directions: Direction[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [scheduleDate, setScheduleDate] = useState<string>(item ? "" : defaultDate);
  const [kolName, setKolName] = useState(item?.kolName ?? "");
  const [kolId, setKolId] = useState<string | null>(item?.kolId ?? null);
  const [direction, setDirection] = useState(item?.categoryDirection ?? "");
  const [tier, setTier] = useState(item?.tier ?? "");
  const [platform, setPlatform] = useState(item?.platform ?? "");
  const [amount, setAmount] = useState<string>(item ? String(item.amount) : "");
  const [status, setStatus] = useState(item?.status ?? "planned");
  const [publishUrl, setPublishUrl] = useState(item?.publishUrl ?? "");
  const [publishDate, setPublishDate] = useState(item?.publishDate ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [continueAdd, setContinueAdd] = useState(false);

  // 取已有 schedule 的日期（item 不返回日期，需要先获取一次）
  useEffect(() => {
    if (!item) return;
    fetch(`/api/kol-schedules/${item.id}`).then(async (r) => {
      const j = await r.json();
      if (r.ok && j.item) {
        setScheduleDate(j.item.schedule_date);
        setPublishDate(j.item.publish_date ?? "");
      }
    });
  }, [item]);

  // 达人类型选项 = schedule_directions 字典
  const directionOptions = useMemo(
    () => directions.map((d) => d.name),
    [directions]
  );

  function reset(date: string) {
    setKolName(""); setKolId(null); setDirection(""); setTier(""); setPlatform("");
    setAmount(""); setStatus("planned"); setPublishUrl(""); setPublishDate("");
    setNotes(""); setScheduleDate(date);
  }

  async function save() {
    setErr("");
    if (!scheduleDate) return setErr("日期必填");
    if (!kolName.trim()) return setErr("达人名必填");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return setErr("费用必须为非负数字");

    setSaving(true);
    const payload = {
      schedule_date: scheduleDate,
      kol_name: kolName.trim(),
      kol_id: kolId,
      category: "",                          // 类目已废弃，永远空字符串
      category_direction: direction,         // 即"达人类型"，存原字段名兼容历史
      tier,
      platform,
      amount: amt,
      status,
      publish_url: publishUrl.trim(),
      publish_date: publishDate || null,
      notes: notes.trim(),
    };
    const url = isEdit ? `/api/kol-schedules/${item!.id}` : "/api/kol-schedules";
    const method = isEdit ? "PATCH" : "POST";
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) return setErr(j.error || "保存失败");

    if (continueAdd && !isEdit) {
      reset(scheduleDate);
      setErr("");
      // 不关 drawer，让用户继续录
      return;
    }
    onSaved();
  }

  async function doDelete() {
    if (!item) return;
    if (!confirm(`删除排期「${item.kolName} · ${fmtCNY(item.amount)}」？此操作不可撤销。`)) return;
    setSaving(true);
    const r = await fetch(`/api/kol-schedules/${item.id}`, { method: "DELETE" });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) return setErr(j.error || "删除失败");
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-xl flex flex-col animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-medium">{isEdit ? "编辑排期" : "新增排期"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <Field label="日期">
            <input type="date" value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </Field>

          <Field label="达人">
            <KolSelector
              name={kolName}
              kolId={kolId}
              onChange={(n, id) => { setKolName(n); setKolId(id); }}
              defaultPlatform={platform}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="达人类型">
              <select value={direction} onChange={(e) => setDirection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                <option value="">—</option>
                {directionOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="层级">
              <select value={tier} onChange={(e) => setTier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                <option value="">—</option>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="平台">
              <input value={platform} onChange={(e) => setPlatform(e.target.value)}
                placeholder="抖音 / 小红书 / 全平台"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </Field>
            <Field label="费用 (¥)">
              <input value={amount} onChange={(e) => setAmount(e.target.value)}
                type="number" min={0}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm tabular-nums" />
            </Field>
          </div>

          <Field label="状态">
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          {(status === "published" || status === "settled") && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="发布链接">
                <div className="flex gap-1">
                  <input value={publishUrl} onChange={(e) => setPublishUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm" />
                  {publishUrl && (
                    <a href={publishUrl} target="_blank" rel="noreferrer"
                      className="px-2 py-2 text-gray-400 hover:text-violet-700">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </Field>
              <Field label="发布日期">
                <input type="date" value={publishDate ?? ""}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
              </Field>
            </div>
          )}

          <Field label="备注">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </Field>

          {err && <p className="text-xs text-rose-600">{err}</p>}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          {isEdit ? (
            <button onClick={doDelete} disabled={saving}
              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline disabled:opacity-50">
              <Trash2 size={14} /> 删除
            </button>
          ) : (
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={continueAdd}
                onChange={(e) => setContinueAdd(e.target.checked)} />
              保存后继续添加
            </label>
          )}
          <div className="flex gap-2">
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

