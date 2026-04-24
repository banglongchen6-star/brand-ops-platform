"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Loader2, CheckCircle2, XCircle, Plus, Trash2, Star } from "lucide-react";

type Provider = "claude" | "qwen" | "openai_compat";

interface ConfigItem {
  id: string;
  provider: Provider;
  label: string;
  model: string;
  base_url: string;
  api_key_last4: string;
  is_active: boolean;
  scope: string;
  created_at: string;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  claude: "Claude（Anthropic）",
  qwen: "千问（阿里 DashScope）",
  openai_compat: "自定义（OpenAI 兼容）",
};

const DEFAULTS: Record<Provider, { model: string; base_url: string }> = {
  claude: { model: "claude-opus-4-6", base_url: "" },
  qwen: { model: "qwen-plus", base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  openai_compat: { model: "", base_url: "" },
};

// 这个弹窗挂在内容运营工作台里，仅管理 scope='content' 的配置
// （其他模块未来各自复用本组件时传入不同 scope）
const MODAL_SCOPE = "content";

export default function AIConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // 新增表单
  const [provider, setProvider] = useState<Provider>("claude");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState(DEFAULTS.claude.model);
  const [baseUrl, setBaseUrl] = useState(DEFAULTS.claude.base_url);
  const [apiKey, setApiKey] = useState("");
  const [activate, setActivate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"idle" | "running" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState("");
  const [msg, setMsg] = useState("");

  // 已保存项的测试态
  const [rowTest, setRowTest] = useState<Record<string, "idle" | "running" | "ok" | "fail">>({});
  const [rowTestMsg, setRowTestMsg] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/ai-config?scope=${MODAL_SCOPE}`);
      if (r.status === 401 || r.status === 403) {
        setMsg("无权访问：仅系统管理员可管理 AI 配置");
        setItems([]);
        return;
      }
      const j = await r.json();
      setItems(j.items ?? []);
    } catch {
      setMsg("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const onProviderChange = (p: Provider) => {
    setProvider(p);
    setModel(DEFAULTS[p].model);
    setBaseUrl(DEFAULTS[p].base_url);
  };

  const resetForm = () => {
    setProvider("claude");
    setLabel("");
    setModel(DEFAULTS.claude.model);
    setBaseUrl(DEFAULTS.claude.base_url);
    setApiKey("");
    setActivate(true);
    setTesting("idle");
    setTestMsg("");
    setMsg("");
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTesting("fail");
      setTestMsg("请填写 API Key");
      return;
    }
    setTesting("running");
    setTestMsg("");
    try {
      const r = await fetch("/api/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, base_url: baseUrl, api_key: apiKey }),
      });
      const j = await r.json();
      if (j.ok) {
        setTesting("ok");
        setTestMsg(`通 · ${j.latencyMs}ms · ${j.sample || ""}`);
      } else {
        setTesting("fail");
        setTestMsg(j.error || "失败");
      }
    } catch (e) {
      setTesting("fail");
      setTestMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMsg("请填写 API Key");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          label,
          model,
          base_url: baseUrl,
          api_key: apiKey,
          activate,
          scope: MODAL_SCOPE,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error || "保存失败");
        return;
      }
      resetForm();
      setShowAdd(false);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    await fetch("/api/ai-config/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此配置？")) return;
    await fetch(`/api/ai-config/${id}`, { method: "DELETE" });
    await load();
  };

  const handleRowTest = async (id: string) => {
    setRowTest((p) => ({ ...p, [id]: "running" }));
    setRowTestMsg((p) => ({ ...p, [id]: "" }));
    try {
      const r = await fetch("/api/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (j.ok) {
        setRowTest((p) => ({ ...p, [id]: "ok" }));
        setRowTestMsg((p) => ({ ...p, [id]: `通 ${j.latencyMs}ms` }));
      } else {
        setRowTest((p) => ({ ...p, [id]: "fail" }));
        setRowTestMsg((p) => ({ ...p, [id]: j.error || "失败" }));
      }
    } catch (e) {
      setRowTest((p) => ({ ...p, [id]: "fail" }));
      setRowTestMsg((p) => ({ ...p, [id]: e instanceof Error ? e.message : String(e) }));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">AI 模型配置 · 内容运营专属</h2>
            <p className="text-xs text-gray-500">API Key 在数据库中以 AES-256-GCM 加密存储，服务端调用时临时解密，前端永不回传明文 · 仅系统管理员可见</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 列表 */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">已保存配置（{items.length}）</h3>
                {!showAdd && (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> 新增配置
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                  暂无内容运营专属配置（未配置时回退到全局配置 / 环境变量默认 key）
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className={`rounded-lg border p-3 ${
                        it.is_active ? "border-purple-300 bg-purple-50/40" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {it.is_active && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                <Star className="h-2.5 w-2.5 fill-white" /> 激活中
                              </span>
                            )}
                            <span className="text-sm font-semibold text-gray-900">
                              {PROVIDER_LABEL[it.provider]}
                            </span>
                            {it.label && <span className="text-xs text-gray-500">· {it.label}</span>}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            模型：<span className="font-mono">{it.model}</span>
                            <span className="mx-2 text-gray-300">|</span>
                            Key：<span className="font-mono">****{it.api_key_last4}</span>
                            {it.base_url && (
                              <>
                                <span className="mx-2 text-gray-300">|</span>
                                <span className="font-mono text-[11px]">{it.base_url}</span>
                              </>
                            )}
                          </div>
                          {rowTestMsg[it.id] && (
                            <div
                              className={`mt-1 text-xs ${
                                rowTest[it.id] === "ok" ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {rowTest[it.id] === "ok" ? "✓ " : "✗ "}
                              {rowTestMsg[it.id]}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => handleRowTest(it.id)}
                            disabled={rowTest[it.id] === "running"}
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {rowTest[it.id] === "running" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "测试"
                            )}
                          </button>
                          {!it.is_active && (
                            <button
                              onClick={() => handleActivate(it.id)}
                              className="rounded-md bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700"
                            >
                              激活
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(it.id)}
                            className="rounded-md border border-gray-200 bg-white p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 新增表单 */}
              {showAdd && (
                <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-800">新增配置</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-700">厂商</label>
                      <div className="flex gap-2">
                        {(["claude", "qwen"] as Provider[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => onProviderChange(p)}
                            className={`flex-1 rounded-md border px-3 py-2 text-xs ${
                              provider === p
                                ? "border-purple-500 bg-white text-purple-700"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {PROVIDER_LABEL[p]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">备注名（可选）</label>
                      <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="例：张三的 key"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">模型名</label>
                      <input
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder={DEFAULTS[provider].model || "自定义模型名"}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-purple-500"
                      />
                    </div>
                    {provider !== "claude" && (
                      <div className="col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-700">接口地址 base_url</label>
                        <input
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          placeholder={DEFAULTS[provider].base_url}
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-purple-500"
                        />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-700">API Key</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-... / 千问 dashscope key"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-purple-500"
                      />
                      <p className="mt-1 text-[11px] text-gray-500">
                        提交后以加密形式保存，前端永不回传明文
                      </p>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="activate-new"
                        checked={activate}
                        onChange={(e) => setActivate(e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor="activate-new" className="text-xs text-gray-700">
                        保存后立即激活（其他配置自动反激活）
                      </label>
                    </div>
                  </div>

                  {testing !== "idle" && (
                    <div
                      className={`mt-3 flex items-center gap-1.5 rounded-md px-3 py-2 text-xs ${
                        testing === "ok"
                          ? "bg-emerald-50 text-emerald-700"
                          : testing === "fail"
                          ? "bg-red-50 text-red-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {testing === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {testing === "ok" && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {testing === "fail" && <XCircle className="h-3.5 w-3.5" />}
                      {testing === "running" ? "测试中..." : testMsg}
                    </div>
                  )}

                  {msg && <div className="mt-2 text-xs text-red-600">{msg}</div>}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        resetForm();
                        setShowAdd(false);
                      }}
                      className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleTest}
                      disabled={testing === "running"}
                      className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      测试连通性
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="rounded-md bg-purple-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {saving ? "保存中..." : "保存"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
