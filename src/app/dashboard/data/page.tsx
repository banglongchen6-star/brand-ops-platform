"use client";

// 数据中心 —— 直接嵌入金山文档《2026年1月-12月销售数据总表》
// 销售数据全部由金山文档那张协作表格维护，本地 sales_data 表 + Excel 导入流程下线
//
// 如果以后想恢复本地销售视图，git 历史里搜 dashboard/data 之前的 commit

import { ExternalLink, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";

const KDOC_URL = "https://365.kdocs.cn/l/ci0nts47m0eY";

export default function DataCenterPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="p-5 min-h-screen bg-gray-50 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">数据中心</h1>
          <p className="text-xs text-gray-400 mt-0.5">金山文档 · 2026 年 1-12 月销售数据总表</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={12} /> 刷新
          </button>
          <a
            href={KDOC_URL}
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
          src={KDOC_URL}
          className="w-full h-full"
          style={{ border: 0, minHeight: "calc(100vh - 140px)" }}
          title="2026 年销售数据总表（金山文档）"
        />
      </div>

      <p className="text-[10px] text-gray-400 mt-2">
        提示：金山文档需用对应账号登录才能编辑。点「新窗口打开」可直接全屏访问。
      </p>
    </div>
  );
}
