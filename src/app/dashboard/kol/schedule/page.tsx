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
  Loader2, X, Save, Trash2, ExternalLink,
} from "lucide-react";

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

interface Category {
  id: string;
  name: string;
  short_name: string;
  default_platform: string;
  default_directions: string[];
  default_requirements: string;
  is_active: boolean;
}

interface Direction { id: string; name: string; is_active: boolean }

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

export default function SchedulePage() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorItem, setEditorItem] = useState<ItemDTO | null>(null);
  const [editorDate, setEditorDate] = useState<string>(todayYMD());

  async function loadData(y: number, m: number) {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/kol-schedules?year=${y}&month=${m}`);
      const j = await r.json();
      if (!r.ok) { setError(j.error || "加载失败"); setData(null); }
      else setData(j as MonthData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadDicts() {
    const [r1, r2] = await Promise.all([
      fetch("/api/schedule-categories"),
      fetch("/api/schedule-directions"),
    ]);
    const j1 = await r1.json(); const j2 = await r2.json();
    if (r1.ok) setCategories((j1.items || []).filter((c: Category) => c.is_active));
    if (r2.ok) setDirections((j2.items || []).filter((d: Direction) => d.is_active));
  }

  useEffect(() => { loadDicts(); }, []);
  useEffect(() => { loadData(year, month); }, [year, month]);

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
    <div className="p-6">
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

      {/* 月度小计（M3 会做完整规划表，先放一行总计） */}
      <div className="mb-3 px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 flex justify-between items-center">
        <span>本月排期 <strong className="text-gray-900 tabular-nums">{data?.totalCount ?? 0}</strong> 条</span>
        <span>已花 <strong className="text-gray-900 tabular-nums">{fmtCNY(data?.monthTotal ?? 0)}</strong></span>
      </div>

      {/* 月历主体 */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400 inline-flex items-center justify-center gap-2 w-full">
          <Loader2 size={16} className="animate-spin" /> 加载中…
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-rose-600">{error}</div>
      ) : data ? (
        <CalendarGrid
          data={data}
          onCellClick={(date) => openCreate(date)}
          onItemClick={(item, date) => openEdit(item, date)}
        />
      ) : null}

      {editorOpen && (
        <ScheduleEditor
          item={editorItem}
          defaultDate={editorDate}
          categories={categories}
          directions={directions}
          onClose={() => setEditorOpen(false)}
          onSaved={() => { setEditorOpen(false); loadData(year, month); }}
        />
      )}
    </div>
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
              <div key={day.date}
                className={`min-h-[110px] border-r border-gray-100 last:border-r-0 p-1.5 group relative
                  ${day.isCurrentMonth ? "bg-white" : "bg-gray-50/60"}
                  ${isToday ? "ring-2 ring-violet-500 ring-inset" : ""}`}>
                {/* 日期标头 */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] tabular-nums ${day.isCurrentMonth ? "text-gray-700" : "text-gray-400"} ${isToday ? "text-violet-700 font-semibold" : ""}`}>
                    {Number(day.date.slice(8, 10))}
                  </span>
                  <button
                    onClick={() => onCellClick(day.date)}
                    className="opacity-0 group-hover:opacity-100 transition w-4 h-4 inline-flex items-center justify-center text-gray-400 hover:text-violet-700"
                    title="新增排期"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* 排期卡片 */}
                {day.items.slice(0, 2).map((item) => (
                  <ItemCard key={item.id} item={item} onClick={() => onItemClick(item, day.date)} />
                ))}
                {day.items.length > 2 && (
                  <button
                    onClick={() => onItemClick(day.items[2], day.date)}
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

function ItemCard({ item, onClick }: { item: ItemDTO; onClick: () => void }) {
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
        {item.categoryShort}
        {item.categoryDirection ? `·${item.categoryDirection}` : ""}
      </div>
    </button>
  );
}

// ───────────────────────────────────────── Editor Drawer ─────────────────────────────────────────

function ScheduleEditor({
  item, defaultDate, categories, directions, onClose, onSaved,
}: {
  item: ItemDTO | null;
  defaultDate: string;
  categories: Category[];
  directions: Direction[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [scheduleDate, setScheduleDate] = useState<string>(item ? "" : defaultDate);
  const [kolName, setKolName] = useState(item?.kolName ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
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

  // 类目联动：选了类目，方向下拉先用类目的 default_directions，再合并字典里其他方向
  const selectedCategory = useMemo(
    () => categories.find((c) => c.name === category),
    [categories, category]
  );
  const directionOptions = useMemo(() => {
    const merged = new Set<string>();
    if (selectedCategory) {
      for (const d of selectedCategory.default_directions || []) merged.add(d);
    }
    for (const d of directions) merged.add(d.name);
    return Array.from(merged);
  }, [selectedCategory, directions]);

  // 选了类目自动填默认平台
  useEffect(() => {
    if (selectedCategory && !platform) {
      setPlatform(selectedCategory.default_platform || "");
    }
  }, [selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset(date: string) {
    setKolName(""); setDirection(""); setTier(""); setPlatform("");
    setAmount(""); setStatus("planned"); setPublishUrl(""); setPublishDate("");
    setNotes(""); setScheduleDate(date);
  }

  async function save() {
    setErr("");
    if (!scheduleDate) return setErr("日期必填");
    if (!kolName.trim()) return setErr("达人名必填");
    if (!category) return setErr("类目必填");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return setErr("费用必须为非负数字");

    setSaving(true);
    const payload = {
      schedule_date: scheduleDate,
      kol_name: kolName.trim(),
      category,
      category_direction: direction,
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="日期">
              <input type="date" value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </Field>
            <Field label="达人名">
              <input value={kolName} onChange={(e) => setKolName(e.target.value)}
                placeholder="如：万万也没想到"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
            </Field>
          </div>

          <Field label="类目">
            <select value={category} onChange={(e) => { setCategory(e.target.value); setDirection(""); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
              <option value="">— 请选择 —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            {selectedCategory?.default_requirements && (
              <p className="text-[10px] text-gray-400 mt-1">{selectedCategory.default_requirements}</p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="方向">
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
