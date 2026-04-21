"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  Edit2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Platform = "douyin" | "xiaohongshu" | "shipinhao" | "weixin";

interface ContentAccount {
  id: string;
  platform: Platform;
  account_name: string;
  account_handle: string | null;
  profile_url: string | null;
  positioning: string | null;
  target_audience: string | null;
  followers: number | null;
  owner_id: string | null;
  status: "active" | "paused" | "archived";
  remark: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

const platformOptions: { value: Platform; label: string; color: string }[] = [
  { value: "douyin", label: "抖音", color: "bg-black text-white" },
  { value: "xiaohongshu", label: "小红书", color: "bg-rose-500 text-white" },
  { value: "shipinhao", label: "视频号", color: "bg-green-500 text-white" },
  { value: "weixin", label: "公众号", color: "bg-emerald-600 text-white" },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "运营中", color: "bg-green-50 text-green-700 border-green-200" },
  paused: { label: "暂停", color: "bg-amber-50 text-amber-700 border-amber-200" },
  archived: { label: "归档", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function ContentAccountsPage() {
  const [accounts, setAccounts] = useState<ContentAccount[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContentAccount | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    platform: "douyin" as Platform,
    account_name: "",
    account_handle: "",
    profile_url: "",
    positioning: "",
    target_audience: "",
    followers: "",
    owner_id: "",
    status: "active" as "active" | "paused" | "archived",
    remark: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: acc }, { data: prof }] = await Promise.all([
      supabase.from("content_accounts").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
    setAccounts((acc as ContentAccount[]) || []);
    setProfiles((prof as Profile[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({
      platform: "douyin",
      account_name: "",
      account_handle: "",
      profile_url: "",
      positioning: "",
      target_audience: "",
      followers: "",
      owner_id: "",
      status: "active",
      remark: "",
    });
    setShowForm(true);
  }

  function openEdit(a: ContentAccount) {
    setEditing(a);
    setForm({
      platform: a.platform,
      account_name: a.account_name,
      account_handle: a.account_handle || "",
      profile_url: a.profile_url || "",
      positioning: a.positioning || "",
      target_audience: a.target_audience || "",
      followers: a.followers ? String(a.followers) : "",
      owner_id: a.owner_id || "",
      status: a.status,
      remark: a.remark || "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.account_name.trim()) {
      alert("请填写账号名称");
      return;
    }
    setSaving(true);
    const payload = {
      platform: form.platform,
      account_name: form.account_name.trim(),
      account_handle: form.account_handle.trim() || null,
      profile_url: form.profile_url.trim() || null,
      positioning: form.positioning.trim() || null,
      target_audience: form.target_audience.trim() || null,
      followers: form.followers ? Number(form.followers) : null,
      owner_id: form.owner_id || null,
      status: form.status,
      remark: form.remark.trim() || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("content_accounts").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("content_accounts").insert(payload));
    }
    setSaving(false);
    if (error) {
      alert("保存失败：" + error.message);
      return;
    }
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除该账号？此操作不可恢复。")) return;
    const { error } = await supabase.from("content_accounts").delete().eq("id", id);
    if (error) {
      alert("删除失败：" + error.message);
      return;
    }
    loadData();
  }

  const filtered = filterPlatform === "all" ? accounts : accounts.filter((a) => a.platform === filterPlatform);

  const countsByPlatform = platformOptions.reduce((acc, p) => {
    acc[p.value] = accounts.filter((a) => a.platform === p.value).length;
    return acc;
  }, {} as Record<Platform, number>);

  function profileName(id: string | null) {
    if (!id) return "—";
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "未知";
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/content"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            返回内容运营
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Users className="h-6 w-6 text-blue-600" />
            账号矩阵
          </h1>
          <p className="mt-1 text-sm text-gray-500">管理全平台运营账号，统一查看粉丝与定位</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          新建账号
        </button>
      </div>

      {/* Platform filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilterPlatform("all")}
          className={`rounded-full border px-3 py-1 text-sm ${
            filterPlatform === "all"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          全部 <span className="ml-1 text-xs opacity-70">{accounts.length}</span>
        </button>
        {platformOptions.map((p) => (
          <button
            key={p.value}
            onClick={() => setFilterPlatform(p.value)}
            className={`rounded-full border px-3 py-1 text-sm ${
              filterPlatform === p.value
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {p.label} <span className="ml-1 text-xs opacity-70">{countsByPlatform[p.value] || 0}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-400">
          <Users className="mb-3 h-8 w-8" />
          <p className="text-sm">暂无账号，点击右上角新建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const plat = platformOptions.find((p) => p.value === a.platform);
            const st = statusLabels[a.status];
            return (
              <div key={a.id} className="group rounded-xl border border-gray-200 bg-white p-4 transition hover:shadow-sm">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${plat?.color || "bg-gray-100 text-gray-700"}`}>
                      {plat?.label || a.platform}
                    </span>
                    <span className={`rounded border px-2 py-0.5 text-xs ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(a)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title="编辑"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-2">
                  <h3 className="text-base font-semibold text-gray-900">{a.account_name}</h3>
                  {a.account_handle && (
                    <p className="text-xs text-gray-500">@{a.account_handle}</p>
                  )}
                </div>

                {a.positioning && (
                  <p className="mb-2 line-clamp-2 text-xs text-gray-600">{a.positioning}</p>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-500">
                  <span>粉丝 <span className="font-medium text-gray-900">{a.followers?.toLocaleString() || "—"}</span></span>
                  <span>运营 {profileName(a.owner_id)}</span>
                </div>

                {a.profile_url && (
                  <a
                    href={a.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    主页链接 <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-semibold">{editing ? "编辑账号" : "新建账号"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="平台 *">
                  <select
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  >
                    {platformOptions.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="状态">
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  >
                    <option value="active">运营中</option>
                    <option value="paused">暂停</option>
                    <option value="archived">归档</option>
                  </select>
                </Field>
              </div>

              <Field label="账号名称 *">
                <input
                  value={form.account_name}
                  onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                  placeholder="如：音乐密码官方号"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="账号ID / Handle">
                  <input
                    value={form.account_handle}
                    onChange={(e) => setForm({ ...form, account_handle: e.target.value })}
                    placeholder="musiccode_official"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  />
                </Field>
                <Field label="粉丝数">
                  <input
                    type="number"
                    value={form.followers}
                    onChange={(e) => setForm({ ...form, followers: e.target.value })}
                    placeholder="10000"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  />
                </Field>
              </div>

              <Field label="主页链接">
                <input
                  value={form.profile_url}
                  onChange={(e) => setForm({ ...form, profile_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <Field label="账号定位">
                <textarea
                  value={form.positioning}
                  onChange={(e) => setForm({ ...form, positioning: e.target.value })}
                  rows={2}
                  placeholder="如：专注音乐教学与乐器分享，面向年轻白领"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <Field label="目标受众">
                <input
                  value={form.target_audience}
                  onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                  placeholder="如：18-30岁女性，一线城市"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>

              <Field label="运营负责人">
                <select
                  value={form.owner_id}
                  onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                >
                  <option value="">未指定</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                  ))}
                </select>
              </Field>

              <Field label="备注">
                <textarea
                  value={form.remark}
                  onChange={(e) => setForm({ ...form, remark: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}
