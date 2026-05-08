"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  X,
  Loader2,
  Star,
  Phone,
  MessageCircle,
  ChevronDown,
  TrendingUp,
  Edit2,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type KolStatus =
  | "pending"
  | "contacted"
  | "negotiating"
  | "cooperating"
  | "published"
  | "reviewed"
  | "blacklist";

interface Kol {
  id: string;
  name: string;
  platform: string;
  followers: number;
  category: string;
  status: KolStatus;
  price: number | null;
  contact: string | null;
  wechat: string | null;
  remark: string | null;
  created_at: string;
}

interface KolCooperation {
  id: string;
  kol_id: string;
  product: string | null;
  cost: number | null;
  sample_sent: boolean;
  expected_publish_date: string | null;
  remark: string | null;
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS: { key: KolStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待建联" },
  { key: "contacted", label: "建联中" },
  { key: "negotiating", label: "洽谈中" },
  { key: "cooperating", label: "合作中" },
  { key: "published", label: "已发布" },
  { key: "reviewed", label: "已复盘" },
  { key: "blacklist", label: "黑名单" },
];

const STATUS_COLORS: Record<KolStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  contacted: "bg-blue-100 text-blue-700",
  negotiating: "bg-yellow-100 text-yellow-700",
  cooperating: "bg-violet-100 text-violet-700",
  published: "bg-green-100 text-green-700",
  reviewed: "bg-teal-100 text-teal-700",
  blacklist: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<KolStatus, string> = {
  pending: "待建联",
  contacted: "建联中",
  negotiating: "洽谈中",
  cooperating: "合作中",
  published: "已发布",
  reviewed: "已复盘",
  blacklist: "黑名单",
};

const PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  bilibili: "B站",
  weibo: "微博",
  kuaishou: "快手",
};

const PLATFORM_COLORS: Record<string, string> = {
  douyin: "bg-black text-white",
  xiaohongshu: "bg-red-500 text-white",
  bilibili: "bg-blue-500 text-white",
  weibo: "bg-orange-500 text-white",
  kuaishou: "bg-yellow-500 text-white",
};

// ── Helper ───────────────────────────────────────────────────────────────────

function formatFollowers(n: number): string {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + "亿";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return String(n);
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ── Add Kol Modal ─────────────────────────────────────────────────────────────

function AddKolModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    platform: "douyin",
    followers: "",
    category: "",
    contact: "",
    wechat: "",
    price: "",
    remark: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("kols").insert({
      name: form.name.trim(),
      platform: form.platform,
      followers: form.followers ? Number(form.followers) : 0,
      category: form.category.trim(),
      contact: form.contact.trim() || null,
      wechat: form.wechat.trim() || null,
      price: form.price ? Number(form.price) : null,
      remark: form.remark.trim() || null,
      status: "pending",
    });
    setSaving(false);
    if (!error) {
      onSuccess();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">添加达人</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">达人姓名 *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="请输入姓名"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">平台</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">粉丝量</label>
              <input
                type="number"
                value={form.followers}
                onChange={(e) => setForm({ ...form, followers: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="如 500000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">类目</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="如 音乐/乐器"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">联系方式</label>
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="手机/邮箱"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">微信</label>
              <input
                value={form.wechat}
                onChange={(e) => setForm({ ...form, wechat: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="微信号"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">报价（元）</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="如 3000"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <textarea
              rows={2}
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              placeholder="其他备注信息"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Record Cooperation Modal ──────────────────────────────────────────────────

function RecordCoopModal({
  kols,
  defaultKolId,
  onClose,
  onSuccess,
}: {
  kols: Kol[];
  defaultKolId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    kol_id: defaultKolId || (kols[0]?.id ?? ""),
    product: "",
    cost: "",
    sample_sent: false,
    expected_publish_date: "",
    remark: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("kol_cooperations").insert({
      kol_id: form.kol_id,
      product: form.product.trim() || null,
      cost: form.cost ? Number(form.cost) : null,
      sample_sent: form.sample_sent,
      expected_publish_date: form.expected_publish_date || null,
      remark: form.remark.trim() || null,
    });
    setSaving(false);
    if (!error) {
      onSuccess();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">记录合作</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">选择达人</label>
            <select
              value={form.kol_id}
              onChange={(e) => setForm({ ...form, kol_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              {kols.map((k) => (
                <option key={k.id} value={k.id}>{k.name} ({PLATFORM_LABELS[k.platform] || k.platform})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">推广商品</label>
              <input
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="商品名称"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">合作费用（元）</label>
              <input
                type="number"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">预计发布日期</label>
              <input
                type="date"
                value={form.expected_publish_date}
                onChange={(e) => setForm({ ...form, expected_publish_date: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sample_sent}
                  onChange={(e) => setForm({ ...form, sample_sent: e.target.checked })}
                  className="w-4 h-4 accent-violet-600"
                />
                是否寄样
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <textarea
              rows={2}
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              placeholder="备注信息"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
              取消
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Kol Card ──────────────────────────────────────────────────────────────────

function KolCard({
  kol,
  onRecordCoop,
  onStatusChange,
}: {
  kol: Kol;
  onRecordCoop: (kol: Kol) => void;
  onStatusChange: (id: string, status: KolStatus) => void;
}) {
  const [dropOpen, setDropOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            {kol.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{kol.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PLATFORM_COLORS[kol.platform] || "bg-gray-200 text-gray-700")}>
                {PLATFORM_LABELS[kol.platform] || kol.platform}
              </span>
              {kol.category && (
                <span className="text-xs text-gray-500">{kol.category}</span>
              )}
            </div>
          </div>
        </div>
        <span className={cn("text-xs px-2 py-1 rounded-full font-medium", STATUS_COLORS[kol.status])}>
          {STATUS_LABELS[kol.status]}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <Users size={13} className="text-violet-400" />
          <span className="font-medium">{formatFollowers(kol.followers)}</span>
          <span className="text-gray-400 text-xs">粉丝</span>
        </div>
        {kol.price != null && (
          <div className="flex items-center gap-1">
            <Star size={13} className="text-yellow-400" />
            <span className="font-medium">¥{kol.price.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Contact */}
      {(kol.contact || kol.wechat) && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {kol.contact && (
            <span className="flex items-center gap-1">
              <Phone size={11} className="text-gray-400" />
              {kol.contact}
            </span>
          )}
          {kol.wechat && (
            <span className="flex items-center gap-1">
              <MessageCircle size={11} className="text-gray-400" />
              {kol.wechat}
            </span>
          )}
        </div>
      )}

      {/* Remark */}
      {kol.remark && (
        <p className="text-xs text-gray-400 line-clamp-2">{kol.remark}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {/* Status dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setDropOpen(!dropOpen)}
            className="w-full flex items-center justify-between gap-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            更新状态
            <ChevronDown size={12} />
          </button>
          {dropOpen && (
            <div className="absolute left-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 z-10 py-1">
              {STATUS_TABS.filter((t) => t.key !== "all").map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    onStatusChange(kol.id, t.key as KolStatus);
                    setDropOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-violet-50 hover:text-violet-700",
                    kol.status === t.key && "text-violet-600 font-medium"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Record coop */}
        <button
          onClick={() => onRecordCoop(kol)}
          className="flex-1 bg-violet-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-violet-700 flex items-center justify-center gap-1"
        >
          <TrendingUp size={12} />
          记录合作
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KolPage() {
  const [kols, setKols] = useState<Kol[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<KolStatus | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [coopKol, setCoopKol] = useState<Kol | null>(null);

  async function fetchKols() {
    setLoading(true);
    const { data } = await supabase
      .from("kols")
      .select("*")
      .order("created_at", { ascending: false });
    setKols(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchKols();
  }, []);

  async function handleStatusChange(id: string, status: KolStatus) {
    await supabase.from("kols").update({ status }).eq("id", id);
    setKols((prev) => prev.map((k) => (k.id === id ? { ...k, status } : k)));
  }

  const filtered = activeTab === "all" ? kols : kols.filter((k) => k.status === activeTab);

  // Stats
  const total = kols.length;
  const cooperating = kols.filter((k) => k.status === "cooperating").length;
  const published = kols.filter((k) => k.status === "published").length;
  const now = new Date();
  const thisMonth = kols.filter((k) => {
    const d = new Date(k.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  return (
    <>
      {/* Header（标题已上移到 layout，这里只放右侧按钮） */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-violet-700 shadow-sm"
        >
          <Plus size={16} />
          添加达人
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={22} className="text-violet-600" />} label="总达人数" value={total} color="bg-violet-50" />
        <StatCard icon={<TrendingUp size={22} className="text-blue-600" />} label="合作中" value={cooperating} color="bg-blue-50" />
        <StatCard icon={<Check size={22} className="text-green-600" />} label="已发布" value={published} color="bg-green-50" />
        <StatCard icon={<Star size={22} className="text-yellow-600" />} label="本月新增" value={thisMonth} color="bg-yellow-50" />
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_TABS.map((t) => {
          const count = t.key === "all" ? kols.length : kols.filter((k) => k.status === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === t.key
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-violet-300"
              )}
            >
              {t.label}
              <span className={cn("ml-1 text-xs", activeTab === t.key ? "text-violet-200" : "text-gray-400")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
            <Users size={28} className="text-violet-300" />
          </div>
          <p className="text-gray-400 text-sm">暂无达人数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((kol) => (
            <KolCard
              key={kol.id}
              kol={kol}
              onRecordCoop={(k) => setCoopKol(k)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddKolModal onClose={() => setShowAdd(false)} onSuccess={fetchKols} />
      )}
      {coopKol && (
        <RecordCoopModal
          kols={kols}
          defaultKolId={coopKol.id}
          onClose={() => setCoopKol(null)}
          onSuccess={fetchKols}
        />
      )}
    </>
  );
}
