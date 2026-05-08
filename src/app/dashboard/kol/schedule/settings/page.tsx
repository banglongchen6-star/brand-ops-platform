"use client";

// 排期表 · 字典管理（manager+ 才能编辑；非 manager 也能查看）
// 路径：/dashboard/kol/schedule/settings

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Save, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { supabase } from "@/lib/supabase";

interface Category {
  id: string;
  name: string;
  short_name: string;
  default_platform: string;
  default_directions: string[];
  default_requirements: string;
  sort_order: number;
  is_active: boolean;
}

interface Direction {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export default function ScheduleSettingsPage() {
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

  const canEdit = isAdmin === true || role === "manager";

  const [tab, setTab] = useState<"categories" | "directions">("categories");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/kol/schedule" className="text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> 返回排期表
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">字典管理</h1>
        <div />
      </div>

      {!canEdit && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          只读模式：仅 admin 或 manager 可以编辑字典。
        </div>
      )}

      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {(["categories", "directions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${
              tab === t
                ? "border-violet-600 text-violet-700 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t === "categories" ? "类目" : "方向"}
          </button>
        ))}
      </div>

      {tab === "categories" ? (
        <CategoriesPanel canEdit={canEdit} />
      ) : (
        <DirectionsPanel canEdit={canEdit} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────── Categories ───────────────────────────────────────────

function CategoriesPanel({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true); setError("");
    const r = await fetch("/api/schedule-categories");
    const j = await r.json();
    if (!r.ok) setError(j.error || "加载失败");
    else setItems(j.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-gray-500">共 {items.length} 个类目（含已停用）</p>
        {canEdit && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs hover:bg-violet-500"
          >
            <Plus size={14} /> 新建类目
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400 inline-flex items-center justify-center gap-2 w-full">
          <Loader2 size={16} className="animate-spin" /> 加载中…
        </div>
      ) : error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-3 py-2 text-left w-12">#</th>
                <th className="px-3 py-2 text-left">名称</th>
                <th className="px-3 py-2 text-left">简称</th>
                <th className="px-3 py-2 text-left">默认平台</th>
                <th className="px-3 py-2 text-left">默认方向</th>
                <th className="px-3 py-2 text-left">要求</th>
                <th className="px-3 py-2 text-center w-20">状态</th>
                <th className="px-3 py-2 text-right w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className={`border-t border-gray-100 ${!c.is_active ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">{c.sort_order}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                  <td className="px-3 py-2 text-gray-700">{c.short_name}</td>
                  <td className="px-3 py-2 text-gray-500">{c.default_platform || "—"}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {(c.default_directions || []).join("、") || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs truncate max-w-[200px]" title={c.default_requirements}>
                    {c.default_requirements || "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {c.is_active ? (
                      <span className="text-green-700">启用</span>
                    ) : (
                      <span className="text-gray-400">已停用</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canEdit && (
                      <button
                        onClick={() => setEditing(c)}
                        className="text-xs text-violet-700 hover:underline"
                      >
                        编辑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-400">暂无类目，先建一个吧</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <CategoryEditor
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function CategoryEditor({
  initial, onClose, onSaved,
}: { initial: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [shortName, setShortName] = useState(initial?.short_name ?? "");
  const [platform, setPlatform] = useState(initial?.default_platform ?? "");
  const [directions, setDirections] = useState<string>(
    (initial?.default_directions ?? []).join("、")
  );
  const [requirements, setRequirements] = useState(initial?.default_requirements ?? "");
  const [sortOrder, setSortOrder] = useState<number>(initial?.sort_order ?? 99);
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr(""); setSaving(true);
    const payload = {
      name: name.trim(),
      short_name: shortName.trim(),
      default_platform: platform.trim(),
      default_directions: directions.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
      default_requirements: requirements.trim(),
      sort_order: sortOrder,
      is_active: isActive,
    };
    if (!payload.name) { setErr("名称不能为空"); setSaving(false); return; }

    const url = initial ? `/api/schedule-categories/${initial.id}` : "/api/schedule-categories";
    const method = initial ? "PATCH" : "POST";
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error || "保存失败"); setSaving(false); return; }
    setSaving(false);
    onSaved();
  }

  async function softDelete() {
    if (!initial) return;
    if (!confirm(`停用类目「${initial.name}」？该类目将不再显示在新建排期的下拉里，已存在的数据不受影响。`)) return;
    setSaving(true);
    const r = await fetch(`/api/schedule-categories/${initial.id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { setErr(j.error || "停用失败"); setSaving(false); return; }
    setSaving(false); onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-medium">{initial ? "编辑类目" : "新建类目"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="名称（必填）">
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </Field>
          <Field label="简称（卡片显示用）">
            <input value={shortName} onChange={(e) => setShortName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </Field>
          <Field label="默认平台">
            <input value={platform} onChange={(e) => setPlatform(e.target.value)}
              placeholder="抖音 / 小红书 / 全平台" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </Field>
          <Field label="默认方向（顿号或逗号分隔）">
            <input value={directions} onChange={(e) => setDirections(e.target.value)}
              placeholder="弹唱、弹奏、鼓棒" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </Field>
          <Field label="内容要求摘要">
            <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="排序">
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm tabular-nums" />
            </Field>
            <Field label="状态">
              <select value={isActive ? "1" : "0"} onChange={(e) => setIsActive(e.target.value === "1")}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm">
                <option value="1">启用</option>
                <option value="0">停用</option>
              </select>
            </Field>
          </div>

          {err && <p className="text-xs text-rose-600">{err}</p>}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
          {initial ? (
            <button onClick={softDelete} disabled={saving}
              className="text-xs text-rose-600 hover:underline disabled:opacity-50">
              停用此类目
            </button>
          ) : <span />}
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

// ─────────────────────────────────────────── Directions ───────────────────────────────────────────

function DirectionsPanel({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<Direction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    const r = await fetch("/api/schedule-directions");
    const j = await r.json();
    if (!r.ok) setError(j.error || "加载失败");
    else setItems(j.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  async function addOne() {
    const name = adding.trim();
    if (!name) return;
    const sortOrder = (items[items.length - 1]?.sort_order ?? 0) + 1;
    const r = await fetch("/api/schedule-directions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sort_order: sortOrder }),
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error || "新增失败"); return; }
    setAdding("");
    load();
  }

  async function patch(id: string, changes: Partial<Direction>) {
    const r = await fetch(`/api/schedule-directions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error || "更新失败"); return; }
    load();
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const swap = items[idx + dir];
    if (!swap) return;
    await Promise.all([
      patch(id, { sort_order: swap.sort_order }),
      patch(swap.id, { sort_order: items[idx].sort_order }),
    ]);
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">共 {items.length} 个方向（含已停用）</p>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400 inline-flex items-center justify-center gap-2 w-full">
          <Loader2 size={16} className="animate-spin" /> 加载中…
        </div>
      ) : error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-3">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-3 py-2 text-left w-12">#</th>
                <th className="px-3 py-2 text-left">名称</th>
                <th className="px-3 py-2 text-center w-20">状态</th>
                <th className="px-3 py-2 text-right w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d, idx) => (
                <tr key={d.id} className={`border-t border-gray-100 ${!d.is_active ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">{d.sort_order}</td>
                  <td className="px-3 py-2 text-gray-900">{d.name}</td>
                  <td className="px-3 py-2 text-center text-xs">
                    {d.is_active ? <span className="text-green-700">启用</span> : <span className="text-gray-400">已停用</span>}
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    {canEdit && (
                      <>
                        <button disabled={idx === 0} onClick={() => move(d.id, -1)}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-30 inline-flex items-center"
                          title="上移">
                          <ChevronUp size={14} />
                        </button>
                        <button disabled={idx === items.length - 1} onClick={() => move(d.id, 1)}
                          className="text-gray-400 hover:text-gray-700 disabled:opacity-30 inline-flex items-center"
                          title="下移">
                          <ChevronDown size={14} />
                        </button>
                        <button onClick={() => patch(d.id, { is_active: !d.is_active })}
                          className="text-xs text-violet-700 hover:underline ml-1">
                          {d.is_active ? "停用" : "启用"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">暂无方向</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <input value={adding} onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addOne()}
            placeholder="新方向名称…"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm" />
          <button onClick={addOne}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs hover:bg-violet-500">
            <Plus size={14} /> 添加
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────── small ───────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
