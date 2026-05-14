// 达人营销 —— 占位 + 跳转到外部达人运营平台
// 公网部署前先用 localhost；后续部署后把 EXTERNAL_URL 改成公网 URL 即可

import { ExternalLink, Users } from "lucide-react";

const EXTERNAL_URL = "http://localhost:8765";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="text-center max-w-md px-6">
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-violet-50 flex items-center justify-center">
          <Users size={36} className="text-violet-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">达人营销</h1>
        <p className="text-sm text-gray-500 mb-6">
          已迁移到外部「达人运营平台」<br />
          <span className="text-[11px] text-gray-400">点击下方按钮在新窗口打开</span>
        </p>
        <a
          href={EXTERNAL_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-500 shadow-sm"
        >
          <ExternalLink size={15} />
          打开达人运营平台
        </a>
        <p className="mt-4 text-[10px] text-gray-300">
          {EXTERNAL_URL}
        </p>
      </div>
    </div>
  );
}
