"use client";

import { useState, useEffect } from "react";
import {
  Swords,
  Plus,
  X,
  ExternalLink,
  Edit2,
  Trash2,
  Sparkles,
  BarChart2,
  Globe,
  Info,
} from "lucide-react";
import { supabase, platformLabels } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Competitor {
  id: string;
  brand: string;
  name: string;
  platform: string;
  shop_url: string | null;
  price_min: number | null;
  price_max: number | null;
  monthly_sales: number | null;
  notes: string | null;
  created_at: string;
}

const platformOptions = [
  { value: "tianmao", label: "天猫" },
  { value: "jingdong", label: "京东" },
  { value: "douyin", label: "抖音" },
  { value: "pinduoduo", label: "拼多多" },
  { value: "other", label: "其他" },
];

const platformColors: Record<string, string> = {
  tianmao: "bg-orange-100 text-orange-700",
  jingdong: "bg-red-100 text-red-700",
  douyin: "bg-pink-100 text-pink-700",
  pinduoduo: "bg-teal-100 text-teal-700",
  other: "bg-gray-100 text-gray-600",
};

const emptyForm = {
  brand: "",
  name: "",
  platform: "tianmao",
  shop_url: "",
  price_min: "",
  price_max: "",
  monthly_sales: "",
  notes: "",
};

export default function CompetitorPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAITip, setShowAITip] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchCompetitors();
  }, []);

  async function fetchCompetitors() {
    setLoading(true);
    const { data, error } = await supabase
      .from("competitors")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setCompetitors(data as Competitor[]);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(c: Competitor) {
    setEditingId(c.id);
    setForm({
      brand: c.brand,
      name: c.name,
      platform: c.platform,
      shop_url: c.shop_url || "",
      price_min: c.price_min != null ? String(c.price_min) : "",
      price_max: c.price_max != null ? String(c.price_max) : "",
      monthly_sales: c.monthly_sales != null ? String(c.monthly_sales) : "",
      notes: c.notes || "",
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!form.brand || !form.name) return;
    setSubmitting(true);
    const payload = {
      brand: form.brand,
      name: form.name,
      platform: form.platform,
      shop_url: form.shop_url || null,
      price_min: form.price_min ? Number(form.price_min) : null,
      price_max: form.price_max ? Number(form.price_max) : null,
      monthly_sales: form.monthly_sales ? Number(form.monthly_sales) : null,
      notes: form.notes || null,
    };
    if (editingId) {
      await supabase.from("competitors").update(payload).eq("id", editingId);
    } else {
      await supabase.from("competitors").insert([payload]);
    }
    setSubmitting(false);
    setShowModal(false);
    fetchCompetitors();
  }

  async function handleDelete(id: string) {
    await supabase.from("competitors").delete().eq("id", id);
    setShowDeleteConfirm(null);
    fetchCompetitors();
  }

  const uniquePlatforms = [...new Set(competitors.map((c) => c.platform))];

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">竞品情报中心</h1>
          <p className="text-sm text-gray-500 mt-1">
            追踪竞品动态，掌握市场格局
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAITip(true)}
            className="flex items-center gap-2 px-4 py-2 border border-violet-300 text-violet-600 rounded-lg text-sm font-medium hover:bg-violet-50 transition-colors"
          >
            <Sparkles size={16} />
            AI 分析
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            <Plus size={16} />
            添加竞品
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gray-100 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <Info size={16} className="text-gray-400 mt-0.5 shrink-0" />
        <p className="text-sm text-gray-600">
          竞品数据以公开信息为主，支持手动录入。建议定期更新价格和销量，保持情报时效性。
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
            <Swords size={20} className="text-violet-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-violet-600">
              {competitors.length}
            </div>
            <div className="text-xs text-gray-500">已录入竞品数</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Globe size={20} className="text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {uniquePlatforms.length}
            </div>
            <div className="text-xs text-gray-500">监控平台数</div>
          </div>
        </div>
      </div>

      {/* Competitor Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="animate-spin w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full mr-2" />
          加载中...
        </div>
      ) : competitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Swords size={40} className="mb-3 opacity-30" />
          <p className="text-sm">暂无竞品数据，点击「添加竞品」开始录入</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {competitors.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">{c.brand}</span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        platformColors[c.platform] || "bg-gray-100 text-gray-600"
                      )}
                    >
                      {platformLabels[c.platform] || c.platform}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-base">{c.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(c.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {c.shop_url && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-16 shrink-0">店铺链接</span>
                    <a
                      href={c.shop_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink size={12} />
                      <span className="truncate">{c.shop_url}</span>
                    </a>
                  </div>
                )}
                {(c.price_min != null || c.price_max != null) && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-16 shrink-0">价格区间</span>
                    <span className="text-gray-700">
                      ¥{c.price_min ?? "?"} ~ ¥{c.price_max ?? "?"}
                    </span>
                  </div>
                )}
                {c.monthly_sales != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-16 shrink-0">月销量</span>
                    <span className="text-gray-700 font-medium">
                      {c.monthly_sales.toLocaleString()} 件
                    </span>
                  </div>
                )}
                {c.notes && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 w-16 shrink-0">备注</span>
                    <span className="text-gray-500 line-clamp-2">{c.notes}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                录入于 {new Date(c.created_at).toLocaleDateString("zh-CN")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "编辑竞品" : "添加竞品"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    品牌 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="如：万魔音频"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    竞品名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如：智能尤克里里 Pro"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  平台
                </label>
                <select
                  value={form.platform}
                  onChange={(e) =>
                    setForm({ ...form, platform: e.target.value })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                >
                  {platformOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  店铺链接
                </label>
                <input
                  type="url"
                  value={form.shop_url}
                  onChange={(e) =>
                    setForm({ ...form, shop_url: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    价格下限 (¥)
                  </label>
                  <input
                    type="number"
                    value={form.price_min}
                    onChange={(e) =>
                      setForm({ ...form, price_min: e.target.value })
                    }
                    placeholder="如：199"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    价格上限 (¥)
                  </label>
                  <input
                    type="number"
                    value={form.price_max}
                    onChange={(e) =>
                      setForm({ ...form, price_max: e.target.value })
                    }
                    placeholder="如：599"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  月销量 (件)
                </label>
                <input
                  type="number"
                  value={form.monthly_sales}
                  onChange={(e) =>
                    setForm({ ...form, monthly_sales: e.target.value })
                  }
                  placeholder="如：1200"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  备注
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  rows={3}
                  placeholder="竞品特点、市场策略等备注信息"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.brand || !form.name}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "保存中..." : editingId ? "保存修改" : "添加竞品"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Tip Modal */}
      {showAITip && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI 分析功能</h3>
            <p className="text-sm text-gray-500 mb-6">
              连接 AI 分析功能开发中，敬请期待
            </p>
            <button
              onClick={() => setShowAITip(false)}
              className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              确认删除
            </h3>
            <p className="text-sm text-gray-500 mb-6">删除后不可恢复，确定继续吗？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
