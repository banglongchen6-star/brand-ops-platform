"use client";

// 客服中心 —— 直接嵌入扣子「售后订单管理系统」工作台
// 整页全屏 iframe，刷新/新窗口按钮浮在右上角，最大化显示区域

import { ExternalLink, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";

const COZE_URL = "https://cxht4vjt69.coze.site";

export default function ServiceCenterPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="relative w-full" style={{ height: "100vh" }}>
      <iframe
        key={reloadKey}
        ref={iframeRef}
        src={COZE_URL}
        className="w-full h-full"
        style={{ border: 0, display: "block" }}
        title="售后订单管理系统"
      />

      {/* 浮在右上角的操作按钮 */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur border border-gray-200 rounded-md text-[11px] text-gray-600 hover:bg-white shadow-sm"
          title="刷新"
        >
          <RefreshCw size={11} /> 刷新
        </button>
        <a
          href={COZE_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur border border-gray-200 rounded-md text-[11px] text-gray-600 hover:bg-white shadow-sm"
          title="新窗口打开"
        >
          <ExternalLink size={11} /> 新窗口
        </a>
      </div>
    </div>
  );
}
