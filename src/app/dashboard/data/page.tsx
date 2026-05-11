"use client";

// 数据中心 —— 直接嵌入扣子工作台的「数据汇总」页面
// 本地销售数据视图（原 sales_data 表 + Excel 导入）已下线，数据全部由扣子系统维护
// 进入扣子站点默认会落在「工作台」tab，显示数据汇总
//
// 如果以后想恢复本地销售视图，git 历史里搜 dashboard/data 之前的 commit

import { ExternalLink, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";

const COZE_URL = "https://cxht4vjt69.coze.site";

export default function DataCenterPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // 通过改 key 强制重新挂载 iframe 来"刷新"，避免跨域改 src 的麻烦
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="p-5 min-h-screen bg-gray-50 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">数据中心</h1>
          <p className="text-xs text-gray-400 mt-0.5">外部系统 · 售后订单数据汇总（扣子）</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={12} /> 刷新
          </button>
          <a
            href={COZE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-500"
          >
            <ExternalLink size={12} /> 新窗口打开
          </a>
        </div>
      </div>

      <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={COZE_URL}
          className="w-full h-full"
          style={{ border: 0, minHeight: "calc(100vh - 140px)" }}
          title="售后订单管理系统"
        />
      </div>

      <p className="text-[10px] text-gray-400 mt-2">
        提示：若 iframe 显示空白或登录提示，可能是该系统不允许嵌入；点击「新窗口打开」直接访问。
      </p>
    </div>
  );
}
