"use client";

// 排期表 · 字典管理（manager+ 才能编辑；非 manager 也能查看）
// 路径：/dashboard/kol/schedule/settings

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ChevronUp, ChevronDown, Loader2, Download } from "lucide-react";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { supabase } from "@/lib/supabase";

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/kol/schedule" className="text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> 返回排期表
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">字典管理</h1>
        <a
          href="/api/kol-schedules/import/template"
          className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1"
        >
          <Download size={12} /> 下载导入模板
        </a>
      </div>

      {!canEdit && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          只读模式：仅 admin 或 manager 可以编辑字典。
        </div>
      )}

      <DirectionsPanel canEdit={canEdit} />
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

