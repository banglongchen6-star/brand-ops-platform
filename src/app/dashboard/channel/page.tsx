"use client";

import { useState, useEffect, useCallback } from "react";
import { Store, Users, Plus, Edit2, X, Check, Loader2, MapPin, Phone, TrendingUp, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Channel = {
  id: string;
  type: "store" | "agent";
  name: string;
  region: string;
  contact_name: string;
  contact_phone: string;
  status: string;
  signed_date: string | null;
  first_order_date: string | null;
  monthly_gmv: number;
  notes: string;
  created_at: string;
};

const typeLabels: Record<string, string> = { store: "门店", agent: "代销商" };
const statusLabels: Record<string, string> = {
  lead: "线索", negotiating: "洽谈中", signed: "已签约", active: "动销中", inactive: "已停止"
};
const statusColors: Record<string, string> = {
  lead: "bg-gray-100 text-gray-600",
  negotiating: "bg-yellow-50 text-yellow-600",
  signed: "bg-blue-50 text-blue-600",
  active: "bg-green-50 text-green-600",
  inactive: "bg-red-50 text-red-500",
};

const emptyForm = { type: "store", name: "", region: "", contact_name: "", contact_phone: "", status: "lead", signed_date: "", first_order_date: "", monthly_gmv: "", notes: "" };

export default function ChannelPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Channel | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("channels").select("*").order("created_at", { ascending: false });
    if (typeFilter !== "all") q = q.eq("type", typeFilter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    setChannels(data || []);
    setLoading(false);
  }, [typeFilter, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c: Channel) => {
    setEditItem(c);
    setForm({ type: c.type, name: c.name, region: c.region, contact_name: c.contact_name, contact_phone: c.contact_phone, status: c.status, signed_date: c.signed_date || "", first_order_date: c.first_order_date || "", monthly_gmv: String(c.monthly_gmv), notes: c.notes });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { type: form.type, name: form.name, region: form.region, contact_name: form.contact_name, contact_phone: form.contact_phone, status: form.status, signed_date: form.signed_date || null, first_order_date: form.first_order_date || null, monthly_gmv: Number(form.monthly_gmv) || 0, notes: form.notes };
    if (editItem) {
      await supabase.from("channels").update(payload).eq("id", editItem.id);
    } else {
      await supabase.from("channels").insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    fetch();
  };

  const stats = {
    total: channels.length,
    stores: channels.filter(c => c.type === "store").length,
    agents: channels.filter(c => c.type === "agent").length,
    active: channels.filter(c => c.status === "active").length,
  };

  return (
    <div className="p-6 max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">渠道分销</h1>
          <p className="text-sm text-gray-500 mt-1">管理门店进驻和个人代销商</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
          <Plus size={16} /> 添加渠道
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "总渠道数", value: stats.total, icon: Store, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "门店", value: stats.stores, icon: Store, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "代销商", value: stats.agents, icon: Users, color: "text-green-600", bg: "bg-green-50" },
          { label: "动销中", value: stats.active, icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">{s.label}</span>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon size={15} className={s.color} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-gray-400" />
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[["all","全部"],["store","门店"],["agent","代销商"]].map(([v,l]) => (
            <button key={v} onClick={() => setTypeFilter(v)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition", typeFilter===v ? "bg-white text-violet-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[["all","全部状态"],...Object.entries(statusLabels)].map(([v,l]) => (
            <button key={v} onClick={() => setStatusFilter(v)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition", statusFilter===v ? "bg-white text-violet-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
        ) : channels.length === 0 ? (
          <div className="text-center py-16">
            <Store size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无渠道数据，点击「添加渠道」开始录入</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left font-medium">渠道名称</th>
                <th className="px-5 py-3 text-left font-medium">类型</th>
                <th className="px-5 py-3 text-left font-medium">区域</th>
                <th className="px-5 py-3 text-left font-medium">联系人</th>
                <th className="px-5 py-3 text-left font-medium">状态</th>
                <th className="px-5 py-3 text-left font-medium">月GMV</th>
                <th className="px-5 py-3 text-left font-medium">签约日期</th>
                <th className="px-5 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {channels.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                        {c.type === "store" ? <Store size={14} className="text-violet-500" /> : <Users size={14} className="text-violet-500" />}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", c.type === "store" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600")}>
                      {typeLabels[c.type]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin size={12} className="text-gray-300" />{c.region || "—"}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-sm text-gray-700">{c.contact_name || "—"}</div>
                    {c.contact_phone && <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><Phone size={10} />{c.contact_phone}</div>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", statusColors[c.status])}>
                      {statusLabels[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-800">
                    {c.monthly_gmv > 0 ? `¥${c.monthly_gmv.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">{c.signed_date || "—"}</td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition">
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{editItem ? "编辑渠道" : "添加渠道"}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: "渠道名称 *", key: "name", placeholder: "请输入门店或代销商名称" },
                { label: "区域", key: "region", placeholder: "如：上海 / 华东" },
                { label: "联系人", key: "contact_name", placeholder: "负责人姓名" },
                { label: "联系电话", key: "contact_phone", placeholder: "手机号" },
                { label: "月GMV (元)", key: "monthly_gmv", placeholder: "0" },
                { label: "签约日期", key: "signed_date", placeholder: "YYYY-MM-DD", type: "date" },
                { label: "备注", key: "notes", placeholder: "其他说明" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})}
                    type={f.type || "text"} placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">类型</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400">
                  <option value="store">门店</option>
                  <option value="agent">代销商</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">状态</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400">
                  {Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50 transition">取消</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2 text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editItem ? "保存修改" : "确认添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
