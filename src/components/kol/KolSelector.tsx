"use client";

// 达人选择器 —— 输入框 + 实时搜索下拉 + 「创建新达人」兜底
//
// 受控用法：
//   <KolSelector
//     name={kolName} kolId={kolId}
//     onChange={(name, id) => { setKolName(name); setKolId(id); }}
//     defaultPlatform={platform}
//   />
//
// 行为：
// - 用户输入即触发 onChange(name, null)，kolId 暂时清空
// - 输入有内容时下拉显示 /api/kols/search 结果（debounce 250ms）
// - 选中某条达人 → onChange(name, id)，下拉关闭
// - 输入框失焦点中 + 没匹配上 → 显示「创建新达人」选项；点击调 /api/kols/quick-create
// - 失焦延迟 150ms 关下拉，避免点击丢失

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus, Loader2 } from "lucide-react";

interface KolItem {
  id: string;
  name: string;
  platform?: string | null;
  followers?: number | null;
  category?: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  bilibili: "B站",
  weibo: "微博",
  kuaishou: "快手",
  other: "其他",
};

function fmtFollowers(n: number | null | undefined): string {
  if (!n || n <= 0) return "";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万粉";
  return `${n} 粉`;
}

export function KolSelector({
  name, kolId, onChange, defaultPlatform = "", placeholder = "搜达人或输入新名字…",
}: {
  name: string;
  kolId: string | null;
  onChange: (name: string, id: string | null) => void;
  defaultPlatform?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 输入变化 → 防抖搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!name.trim()) { setItems([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/kols/search?q=${encodeURIComponent(name.trim())}`);
        const j = await r.json();
        if (r.ok) setItems(j.items || []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [name]);

  function pick(item: KolItem) {
    onChange(item.name, item.id);
    setOpen(false);
  }

  async function createNew() {
    setErr(""); setCreating(true);
    const r = await fetch("/api/kols/quick-create", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), platform: normalizePlatform(defaultPlatform) }),
    });
    const j = await r.json();
    setCreating(false);
    if (!r.ok) { setErr(j.error || "创建失败"); return; }
    onChange(j.item.name, j.item.id);
    setOpen(false);
  }

  // 已选中（kolId 有值）且名字没变 → 视作"已绑定"，输入框不再展开下拉
  const matchedExisting = items.find((it) => it.name === name.trim());
  const showCreate = name.trim() && !creating && !matchedExisting && !loading;

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={name}
          onChange={(e) => { onChange(e.target.value, null); setOpen(true); setErr(""); }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            blurTimerRef.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-violet-400"
        />
        {kolId && (
          <span title="已关联达人库" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
            已绑定
          </span>
        )}
      </div>

      {open && name.trim() && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-gray-400 inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> 搜索中…
            </div>
          )}
          {!loading && items.length === 0 && !showCreate && (
            <div className="px-3 py-2 text-xs text-gray-400">无匹配达人</div>
          )}
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(it)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 flex items-center gap-2"
            >
              <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[11px] font-semibold shrink-0">
                {it.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 truncate">{it.name}</div>
                <div className="text-[10px] text-gray-400 truncate">
                  {[
                    PLATFORM_LABEL[it.platform || ""] || it.platform,
                    fmtFollowers(it.followers ?? null),
                    it.category,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={createNew}
              disabled={creating}
              className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 border-t border-gray-100 inline-flex items-center gap-2 text-violet-700 disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              创建新达人「{name.trim()}」
              {defaultPlatform && PLATFORM_LABEL[normalizePlatform(defaultPlatform)] && (
                <span className="text-[10px] text-gray-400 ml-1">
                  · 平台默认 {PLATFORM_LABEL[normalizePlatform(defaultPlatform)]}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {err && <p className="text-[11px] text-rose-600 mt-1">{err}</p>}
    </div>
  );
}

// 排期表的 platform 可能是「抖音」「小红书」等中文，要映射成 kols.platform 的英文 slug
function normalizePlatform(p: string): string {
  const v = (p || "").trim();
  if (!v) return "";
  const map: Record<string, string> = {
    "抖音": "douyin",
    "抖音为主": "douyin",
    "小红书": "xiaohongshu",
    "B站": "bilibili",
    "b站": "bilibili",
    "bilibili": "bilibili",
    "微博": "weibo",
    "快手": "kuaishou",
    "全平台": "other",
  };
  return map[v] ?? (v.toLowerCase());
}
