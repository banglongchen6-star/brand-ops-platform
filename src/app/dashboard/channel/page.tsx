"use client";

// 渠道分销 —— 线下门店管理
// 顶部品牌分布 + 区域分布卡片，搜索 + 筛选，表格 CRUD（仿 coze.site 线下门店页）

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, MapPin, Pencil, Trash2, X, Store as StoreIcon } from "lucide-react";

type Store = {
  id: string;
  brand: string;
  name: string;
  address: string;
  region: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

// 品牌颜色调色板（按品牌名 hash 出固定颜色）
const BRAND_PALETTE = [
  "#3B82F6", // blue
  "#F97316", // orange
  "#EF4444", // red
  "#A855F7", // purple
  "#10B981", // green
  "#EAB308", // yellow
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#6B7280", // gray —— 兜底"其他门店"
];

function brandColor(brand: string): string {
  const b = (brand || "").trim();
  if (!b || b === "其他门店" || b === "其他") return "#6B7280";
  let h = 0;
  for (let i = 0; i < b.length; i++) h = (h * 31 + b.charCodeAt(i)) >>> 0;
  return BRAND_PALETTE[h % (BRAND_PALETTE.length - 1)]; // 不选最后一个灰色
}

type FormState = {
  brand: string;
  name: string;
  address: string;
  region: string;
  notes: string;
};

const EMPTY_FORM: FormState = { brand: "", name: "", address: "", region: "", notes: "" };

export default function ChannelStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  // 弹窗
  const [editing, setEditing] = useState<Store | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 加载列表
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/stores");
      const j = await r.json();
      setStores(j.stores ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // 派生：品牌分布 / 区域分布 / 唯一值
  const stats = useMemo(() => {
    const brandMap = new Map<string, number>();
    const regionMap = new Map<string, number>();
    for (const s of stores) {
      const b = s.brand?.trim() || "其他门店";
      brandMap.set(b, (brandMap.get(b) ?? 0) + 1);
      const r = s.region?.trim();
      if (r) regionMap.set(r, (regionMap.get(r) ?? 0) + 1);
    }
    const brands = [...brandMap.entries()].sort((a, b) => b[1] - a[1]);
    const regions = [...regionMap.entries()].sort((a, b) => b[1] - a[1]);
    return { brands, regions };
  }, [stores]);

  // 客户端筛选（小数据量直接前端过滤更顺手）
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return stores.filter((s) => {
      if (brandFilter && (s.brand || "").trim() !== brandFilter) return false;
      if (regionFilter && (s.region || "").trim() !== regionFilter) return false;
      if (kw) {
        const hay = `${s.name} ${s.address} ${s.brand} ${s.region}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [stores, q, brandFilter, regionFilter]);

  // 打开新增 / 编辑
  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }
  function openEdit(s: Store) {
    setEditing(s);
    setForm({
      brand: s.brand || "",
      name: s.name || "",
      address: s.address || "",
      region: s.region || "",
      notes: s.notes || "",
    });
    setError("");
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  // 保存
  async function save() {
    if (!form.name.trim()) {
      setError("门店名称不能为空");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editing ? `/api/stores/${editing.id}` : "/api/stores";
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "保存失败");
        return;
      }
      closeForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "网络错误");
    } finally {
      setSaving(false);
    }
  }

  // 删除
  async function remove(s: Store) {
    if (!confirm(`确认删除门店「${s.name}」？此操作无法撤销。`)) return;
    const r = await fetch(`/api/stores/${s.id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "删除失败");
      return;
    }
    await load();
  }

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* 标题栏 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
          <StoreIcon size={18} />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">线下门店</h1>
        <span className="text-sm text-gray-500">共 {stores.length} 家门店</span>
      </div>

      {/* 品牌分布 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="text-sm text-gray-500 mb-3">品牌分布</div>
        {stats.brands.length === 0 ? (
          <div className="text-sm text-gray-400">暂无数据</div>
        ) : (
          <div className="grid grid-cols-3 gap-y-2 gap-x-8">
            {stats.brands.map(([b, n]) => (
              <div key={b} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: brandColor(b) }}
                  />
                  <span className="text-gray-800">{b}</span>
                </span>
                <span className="text-gray-900 font-medium tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 区域分布 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="text-sm text-gray-500 mb-3">区域分布</div>
        {stats.regions.length === 0 ? (
          <div className="text-sm text-gray-400">暂无数据</div>
        ) : (
          <div className="grid grid-cols-3 gap-y-2 gap-x-8">
            {stats.regions.map(([r, n]) => (
              <div key={r} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-gray-800">
                  <MapPin size={13} className="text-gray-400" /> {r}
                </span>
                <span className="text-gray-900 font-medium tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 筛选区 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索门店名称、地址、品牌..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
          />
        </div>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
        >
          <option value="">全部品牌</option>
          {stats.brands.map(([b]) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
        >
          <option value="">全部区域</option>
          {stats.regions.map(([r]) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          onClick={openNew}
          className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-black"
        >
          <Plus size={15} /> 新增门店
        </button>
      </div>

      {/* 表格 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3 w-32">品牌</th>
                <th className="px-4 py-3">门店名称</th>
                <th className="px-4 py-3">地址</th>
                <th className="px-4 py-3 w-32">区域</th>
                <th className="px-4 py-3 w-40">备注</th>
                <th className="px-4 py-3 w-20 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    加载中...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    {stores.length === 0 ? "暂无门店，点「新增门店」开始录入" : "没有符合筛选条件的门店"}
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-gray-500 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-800">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: brandColor(s.brand) }}
                        />
                        {s.brand || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-700">{s.address || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{s.region || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{s.notes || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-gray-500 hover:text-gray-900"
                          title="编辑"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(s)}
                          className="text-gray-400 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新增/编辑 弹窗 */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeForm}
        >
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="text-base font-semibold text-gray-900">
                {editing ? "编辑门店" : "新增门店"}
              </div>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <Field label="品牌">
                <input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="如 Z·Pilot / 机器时代"
                  list="brand-options"
                  className="input"
                />
                <datalist id="brand-options">
                  {stats.brands.map(([b]) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
              <Field label="门店名称" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如 上海国金中心IFC店"
                  className="input"
                />
              </Field>
              <Field label="地址">
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="详细地址"
                  className="input"
                />
              </Field>
              <Field label="区域">
                <input
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="如 上海 / 广东"
                  list="region-options"
                  className="input"
                />
                <datalist id="region-options">
                  {stats.regions.map(([r]) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field label="备注">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="可选"
                  rows={2}
                  className="input resize-none"
                />
              </Field>
              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
                  {error}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={closeForm}
                className="px-3.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                取消
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-3.5 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-black disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          padding: 7px 10px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
          color: #111827;
          outline: none;
        }
        :global(.input:focus) {
          border-color: #9ca3af;
        }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
