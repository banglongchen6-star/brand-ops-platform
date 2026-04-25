"use client";

// 公众号配置管理 —— 添加/编辑/删除公众号 AppID + AppSecret
// 路径: /dashboard/articles/settings

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Edit2, Loader2, Check, X,
  AlertCircle, Save, Eye, EyeOff,
} from "lucide-react";

interface PublishConfig {
  id: string;
  name: string;
  app_id: string;
  account_type: string;
  default_author: string;
  enabled: boolean;
  notes: string;
  app_secret_set: boolean;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function PublishConfigsPage() {
  const [configs, setConfigs] = useState<PublishConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PublishConfig | null>(null);
  const [form, setForm] = useState({
    name: "", app_id: "", app_secret: "",
    account_type: "service" as "service" | "subscription",
    default_author: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/wx-publish-configs");
    const j = await r.json();
    setConfigs(j.configs || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", app_id: "", app_secret: "", account_type: "service", default_author: "", notes: "" });
    setShowForm(true);
  }
  function openEdit(c: PublishConfig) {
    setEditing(c);
    setForm({
      name: c.name, app_id: c.app_id, app_secret: "",
      account_type: (c.account_type as "service" | "subscription") || "service",
      default_author: c.default_author || "", notes: c.notes || "",
    });
    setShowForm(true);
  }

  async function save() {
    setError(""); setSaving(true);
    const url = editing ? `/api/wx-publish-configs/${editing.id}` : "/api/wx-publish-configs";
    const r = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) { setError(j.error || "保存失败"); return; }
    setShowForm(false);
    await load();
  }

  async function toggleEnabled(c: PublishConfig) {
    await fetch(`/api/wx-publish-configs/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !c.enabled }),
    });
    await load();
  }

  async function remove(c: PublishConfig) {
    if (!confirm(`确认删除「${c.name}」？删除后无法恢复，且关联的草稿会失去公众号关联。`)) return;
    await fetch(`/api/wx-publish-configs/${c.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/articles" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">公众号配置</h1>
            <p className="text-xs text-gray-500 mt-0.5">添加企业服务号 / 订阅号的 AppID 和 AppSecret，发布时选择推送到哪个号</p>
          </div>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">
          <Plus size={14} />添加公众号
        </button>
      </div>

      {/* IP 白名单提醒 */}
      <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold mb-1">IP 白名单是必须的</p>
            <p className="text-xs leading-relaxed">
              微信要求调用 access_token 的 IP 在公众号后台白名单里。Vercel 出口 IP 是动态的（多个），
              首次推送报 <code className="bg-amber-100 px-1 rounded">40164</code> 时，按报错信息把出现的 IP 复制到
              「公众号后台 → 设置与开发 → 基本配置 → IP 白名单」。
              建议先小范围测试，遇到一个 IP 加一个。
            </p>
          </div>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={18} />加载中...
        </div>
      ) : configs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-16 text-center text-sm text-gray-500">
          还没有公众号，点右上角「添加公众号」开始
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map((c) => (
            <div key={c.id}
              className={"bg-white border rounded-xl p-4 flex items-center gap-4 " +
                (c.enabled ? "border-gray-200" : "border-gray-200 opacity-60")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                    {c.account_type === "subscription" ? "订阅号" : "企业服务号"}
                  </span>
                  {!c.enabled && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">已停用</span>}
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>AppID: <span className="font-mono">{c.app_id}</span></div>
                  <div>AppSecret: <span className="font-mono">{c.app_secret_set ? "已加密保存" : "未设置"}</span></div>
                  {c.default_author && <div>默认作者：{c.default_author}</div>}
                  {c.token_expires_at && (
                    <div className="text-[10px] text-gray-400">
                      access_token 到期：{new Date(c.token_expires_at).toLocaleString("zh-CN")}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleEnabled(c)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title={c.enabled ? "停用" : "启用"}>
                  {c.enabled ? <Check size={14} className="text-green-600" /> : <X size={14} />}
                </button>
                <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => remove(c)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-500">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{editing ? "编辑公众号" : "添加公众号"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            {error && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-sm rounded flex items-center gap-1">
              <AlertCircle size={14} />{error}
            </div>}

            <div className="space-y-3">
              <Field label="名称（备注）" required>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例：音乐密码服务号"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
              </Field>

              <Field label="账号类型">
                <div className="flex gap-2">
                  {(["service", "subscription"] as const).map((t) => (
                    <button key={t} onClick={() => setForm({ ...form, account_type: t })}
                      className={"flex-1 px-3 py-2 text-sm rounded-lg border " +
                        (form.account_type === t ? "bg-violet-50 border-violet-400 text-violet-700" : "border-gray-200 text-gray-600 hover:bg-gray-50")}>
                      {t === "service" ? "企业服务号" : "订阅号"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="AppID" required>
                <input value={form.app_id} onChange={(e) => setForm({ ...form, app_id: e.target.value })}
                  placeholder="wx 开头的 18 位字符"
                  className="w-full px-3 py-2 font-mono border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
              </Field>

              <Field label="AppSecret" required={!editing}>
                <div className="relative">
                  <input type={showSecret ? "text" : "password"}
                    value={form.app_secret} onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
                    placeholder={editing ? "留空则不修改" : "32 位密钥"}
                    className="w-full px-3 py-2 pr-10 font-mono border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
                  <button type="button" onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">在公众号后台「设置 → 开发 → 基本配置」获取</p>
              </Field>

              <Field label="默认作者署名">
                <input value={form.default_author} onChange={(e) => setForm({ ...form, default_author: e.target.value })}
                  placeholder="例：音乐密码编辑部"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-violet-400" />
              </Field>

              <Field label="备注">
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="可选"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-violet-400" />
              </Field>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editing ? "保存修改" : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
