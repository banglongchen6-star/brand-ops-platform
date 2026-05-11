"use client";

// 客服中心 —— 直接嵌入扣子「售后订单管理系统」工作台
// 售后/退货/补发/返现 等订单全部由扣子那边维护
// 原本本地的 service_tickets 工单管理（presale/aftersale/return/complaint）已下线
//
// 如果以后想恢复本地工单视图，git 历史里搜 dashboard/service 之前的 commit

import { ExternalLink, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";

const COZE_URL = "https://cxht4vjt69.coze.site";

export default function ServiceCenterPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // 改 key 强制重挂 iframe 实现"刷新"
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="p-5 min-h-screen bg-gray-50 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">客服中心</h1>
          <p className="text-xs text-gray-400 mt-0.5">外部系统 · 售后订单管理（扣子）</p>
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
