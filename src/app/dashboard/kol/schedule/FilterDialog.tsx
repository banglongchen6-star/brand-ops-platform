"use client";

// 排期筛选弹窗 —— 多选「类目」+「层级」
// 用户点确定后把所选项返给父组件，父组件把它们拼到 GET /api/kol-schedules 的查询串

import { X, Check } from "lucide-react";
import { useState } from "react";

const TIERS = ["头部", "中部", "腰部", "尾部", "素人"] as const;

export function FilterDialog({
  categories,
  initialSelectedCats,
  initialSelectedTiers,
  onClose,
  onApply,
  onReset,
}: {
  categories: { name: string; short_name: string }[];
  initialSelectedCats: string[];
  initialSelectedTiers: string[];
  onClose: () => void;
  onApply: (cats: string[], tiers: string[]) => void;
  onReset: () => void;
}) {
  const [cats, setCats] = useState<Set<string>>(new Set(initialSelectedCats));
  const [tiers, setTiers] = useState<Set<string>>(new Set(initialSelectedTiers));

  function toggleCat(name: string) {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }
  function toggleTier(t: string) {
    setTiers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-medium">筛选排期</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <p className="text-xs text-gray-500 mb-2">类目（不勾默认全部）</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const on = cats.has(c.name);
                return (
                  <button key={c.name} onClick={() => toggleCat(c.name)}
                    className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
                      on
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {on && <Check size={11} />}
                    {c.short_name || c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">层级（不勾默认全部）</p>
            <div className="flex flex-wrap gap-1.5">
              {TIERS.map((t) => {
                const on = tiers.has(t);
                return (
                  <button key={t} onClick={() => toggleTier(t)}
                    className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
                      on
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {on && <Check size={11} />}
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
          <button onClick={() => { setCats(new Set()); setTiers(new Set()); onReset(); }}
            className="text-xs text-gray-500 hover:text-gray-900">清空全部</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">取消</button>
            <button onClick={() => onApply(Array.from(cats), Array.from(tiers))}
              className="px-4 py-1.5 rounded-md bg-violet-600 text-white text-xs hover:bg-violet-500">
              应用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
