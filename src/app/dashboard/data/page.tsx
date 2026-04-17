"use client";

import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  FileVideo,
  GitBranch,
  Download,
  Info,
  MapPin,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardTab = "sales" | "kol" | "content" | "channel";

// ---- Mock Data ----

const DAYS = ["4/9", "4/10", "4/11", "4/12", "4/13", "4/14", "4/15"];

const salesGMV = {
  tianmao:   [42000, 38500, 51000, 47200, 62300, 58900, 71400],
  jingdong:  [28000, 31200, 27800, 34500, 29700, 41000, 38600],
  douyin:    [63000, 71000, 85000, 78500, 91200, 103000, 115000],
  pinduoduo: [19000, 22300, 18700, 24100, 27500, 21800, 26400],
};

const platformShare = [
  { name: "抖音", value: 43, color: "bg-pink-500" },
  { name: "天猫", value: 27, color: "bg-orange-400" },
  { name: "京东", value: 19, color: "bg-red-400" },
  { name: "拼多多", value: 11, color: "bg-teal-400" },
];

const kolData = {
  total: 128,
  statusDist: [
    { label: "合作中", count: 47, color: "bg-green-500" },
    { label: "洽谈中", count: 23, color: "bg-blue-400" },
    { label: "待联系", count: 35, color: "bg-amber-400" },
    { label: "已完成", count: 23, color: "bg-gray-400" },
  ],
  avgROI: 4.7,
  topKols: [
    { name: "@音乐小林", platform: "抖音", fans: "128万", roi: 6.2 },
    { name: "@乐器达人Emma", platform: "小红书", fans: "82万", roi: 5.8 },
    { name: "@尤克里里陈老师", platform: "抖音", fans: "241万", roi: 5.1 },
    { name: "@键盘王大壮", platform: "B站", fans: "56万", roi: 4.9 },
  ],
};

const contentData = {
  total: 342,
  platformDist: [
    { name: "抖音", count: 156, color: "bg-pink-500" },
    { name: "小红书", count: 98, color: "bg-red-400" },
    { name: "B站", count: 54, color: "bg-blue-500" },
    { name: "微信视频号", count: 34, color: "bg-green-500" },
  ],
  avgViews: 28600,
  recent: [
    { title: "音乐密码尤克里里开箱测评", platform: "抖音", views: 128000, likes: 8700 },
    { title: "智能乐器选购指南2026", platform: "小红书", views: 64000, likes: 4200 },
    { title: "零基础学吉他·第一课", platform: "B站", views: 41000, likes: 2900 },
    { title: "亲子音乐课推荐好物", platform: "小红书", views: 38000, likes: 3100 },
  ],
};

const channelData = {
  total: 86,
  typeDist: [
    { label: "直营门店", count: 12, color: "bg-violet-500" },
    { label: "代销商", count: 74, color: "bg-blue-400" },
  ],
  regionDist: [
    { region: "华东", count: 28, percent: 33 },
    { region: "华南", count: 19, percent: 22 },
    { region: "华北", count: 17, percent: 20 },
    { region: "华中", count: 11, percent: 13 },
    { region: "西南", count: 7, percent: 8 },
    { region: "其他", count: 4, percent: 4 },
  ],
};

// ---- Helpers ----

const maxGMV = Math.max(...Object.values(salesGMV).flatMap((v) => v));

function formatNum(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString();
}

function totalDayGMV(idx: number) {
  return (
    salesGMV.tianmao[idx] +
    salesGMV.jingdong[idx] +
    salesGMV.douyin[idx] +
    salesGMV.pinduoduo[idx]
  );
}

const avgDailyGMV =
  DAYS.reduce((s, _, i) => s + totalDayGMV(i), 0) / DAYS.length;

// ---- Tab Configs ----

const tabs: { key: DashboardTab; label: string; icon: React.ReactNode }[] = [
  { key: "sales", label: "销售看板", icon: <TrendingUp size={15} /> },
  { key: "kol", label: "达人看板", icon: <Users size={15} /> },
  { key: "content", label: "内容看板", icon: <FileVideo size={15} /> },
  { key: "channel", label: "渠道看板", icon: <GitBranch size={15} /> },
];

const platformBarColors: Record<string, string> = {
  tianmao: "bg-orange-400",
  jingdong: "bg-red-400",
  douyin: "bg-pink-500",
  pinduoduo: "bg-teal-400",
};

const platformNameMap: Record<string, string> = {
  tianmao: "天猫",
  jingdong: "京东",
  douyin: "抖音",
  pinduoduo: "拼多多",
};

// ---- Sub-panels ----

function SalesDashboard({ onExport }: { onExport: () => void }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-violet-50 rounded-xl p-4">
          <p className="text-xs text-violet-500 mb-1">近7天总GMV</p>
          <p className="text-2xl font-bold text-violet-700">
            ¥{formatNum(DAYS.reduce((s, _, i) => s + totalDayGMV(i), 0))}
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 mb-1">日均GMV</p>
          <p className="text-2xl font-bold text-blue-700">
            ¥{formatNum(Math.round(avgDailyGMV))}
          </p>
        </div>
        <div className="bg-pink-50 rounded-xl p-4">
          <p className="text-xs text-pink-500 mb-1">抖音占比</p>
          <p className="text-2xl font-bold text-pink-600">43%</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          近7天各平台GMV趋势
        </h3>
        <div className="flex items-end gap-2 h-48">
          {DAYS.map((day, i) => {
            const total = totalDayGMV(i);
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{formatNum(total)}</span>
                <div className="w-full flex flex-col-reverse gap-0.5">
                  {(
                    [
                      ["tianmao", salesGMV.tianmao[i]],
                      ["jingdong", salesGMV.jingdong[i]],
                      ["douyin", salesGMV.douyin[i]],
                      ["pinduoduo", salesGMV.pinduoduo[i]],
                    ] as [string, number][]
                  ).map(([plat, val]) => {
                    const pct = (val / maxGMV) * 160;
                    return (
                      <div
                        key={plat}
                        title={`${platformNameMap[plat]}: ¥${val.toLocaleString()}`}
                        className={cn(
                          "w-full rounded-sm",
                          platformBarColors[plat]
                        )}
                        style={{ height: `${pct}px` }}
                      />
                    );
                  })}
                </div>
                <span className="text-xs text-gray-400">{day}</span>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex gap-4 mt-3 flex-wrap">
          {Object.entries(platformNameMap).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={cn("w-2.5 h-2.5 rounded-sm", platformBarColors[k])} />
              {v}
            </div>
          ))}
        </div>
      </div>

      {/* Platform Share */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">平台GMV占比</h3>
        <div className="space-y-3">
          {platformShare.map((p) => (
            <div key={p.name}>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{p.name}</span>
                <span className="font-medium">{p.value}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", p.color)}
                  style={{ width: `${p.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 border border-violet-300 text-violet-600 rounded-lg text-sm hover:bg-violet-50"
        >
          <Download size={15} />
          导出报表
        </button>
      </div>
    </div>
  );
}

function KolDashboard({ onExport }: { onExport: () => void }) {
  const maxCount = Math.max(...kolData.statusDist.map((s) => s.count));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-violet-50 rounded-xl p-4">
          <p className="text-xs text-violet-500 mb-1">合作达人总数</p>
          <p className="text-2xl font-bold text-violet-700">{kolData.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600 mb-1">当前合作中</p>
          <p className="text-2xl font-bold text-green-700">
            {kolData.statusDist[0].count}
          </p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs text-amber-600 mb-1">平均ROI</p>
          <p className="text-2xl font-bold text-amber-600">{kolData.avgROI}x</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">达人状态分布</h3>
        <div className="space-y-3">
          {kolData.statusDist.map((s) => (
            <div key={s.label}>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{s.label}</span>
                <span className="font-medium">{s.count} 人</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", s.color)}
                  style={{ width: `${(s.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">高ROI达人 TOP 4</h3>
        <div className="space-y-3">
          {kolData.topKols.map((k, i) => (
            <div
              key={k.name}
              className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    i === 0
                      ? "bg-yellow-100 text-yellow-600"
                      : i === 1
                      ? "bg-gray-100 text-gray-600"
                      : "bg-orange-50 text-orange-500"
                  )}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{k.name}</p>
                  <p className="text-xs text-gray-400">
                    {k.platform} · {k.fans}粉丝
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold text-violet-600">
                <Star size={13} className="fill-violet-400 text-violet-400" />
                {k.roi}x
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 border border-violet-300 text-violet-600 rounded-lg text-sm hover:bg-violet-50"
        >
          <Download size={15} />
          导出报表
        </button>
      </div>
    </div>
  );
}

function ContentDashboard({ onExport }: { onExport: () => void }) {
  const maxCount = Math.max(...contentData.platformDist.map((p) => p.count));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-violet-50 rounded-xl p-4">
          <p className="text-xs text-violet-500 mb-1">发布内容总数</p>
          <p className="text-2xl font-bold text-violet-700">{contentData.total}</p>
        </div>
        <div className="bg-pink-50 rounded-xl p-4">
          <p className="text-xs text-pink-500 mb-1">平均播放量</p>
          <p className="text-2xl font-bold text-pink-600">
            {formatNum(contentData.avgViews)}
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 mb-1">覆盖平台</p>
          <p className="text-2xl font-bold text-blue-700">
            {contentData.platformDist.length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">各平台内容分布</h3>
        <div className="space-y-3">
          {contentData.platformDist.map((p) => (
            <div key={p.name}>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{p.name}</span>
                <span className="font-medium">{p.count} 篇</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", p.color)}
                  style={{ width: `${(p.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">近期高播量内容</h3>
        <div className="space-y-3">
          {contentData.recent.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{r.title}</p>
                <p className="text-xs text-gray-400">{r.platform}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-700">
                  {formatNum(r.views)} 播放
                </p>
                <p className="text-xs text-gray-400">
                  {formatNum(r.likes)} 点赞
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 border border-violet-300 text-violet-600 rounded-lg text-sm hover:bg-violet-50"
        >
          <Download size={15} />
          导出报表
        </button>
      </div>
    </div>
  );
}

function ChannelDashboard({ onExport }: { onExport: () => void }) {
  const maxRegionCount = Math.max(...channelData.regionDist.map((r) => r.count));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-violet-50 rounded-xl p-4">
          <p className="text-xs text-violet-500 mb-1">渠道总数</p>
          <p className="text-2xl font-bold text-violet-700">{channelData.total}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-500 mb-1">代销商</p>
          <p className="text-2xl font-bold text-blue-700">
            {channelData.typeDist[1].count}
          </p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600 mb-1">直营门店</p>
          <p className="text-2xl font-bold text-green-700">
            {channelData.typeDist[0].count}
          </p>
        </div>
      </div>

      {/* Type Distribution */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          门店 vs 代销商占比
        </h3>
        <div className="h-4 rounded-full overflow-hidden flex gap-0.5 mb-3">
          {channelData.typeDist.map((t) => (
            <div
              key={t.label}
              className={cn("h-full", t.color)}
              style={{ width: `${(t.count / channelData.total) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex gap-6">
          {channelData.typeDist.map((t) => (
            <div key={t.label} className="flex items-center gap-2 text-sm text-gray-600">
              <span className={cn("w-3 h-3 rounded-sm", t.color)} />
              <span>{t.label}</span>
              <span className="font-medium text-gray-800">
                {t.count} ({Math.round((t.count / channelData.total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Region Distribution */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          <span className="flex items-center gap-2">
            <MapPin size={14} className="text-violet-400" />
            各地区渠道分布
          </span>
        </h3>
        <div className="space-y-3">
          {channelData.regionDist.map((r) => (
            <div key={r.region}>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{r.region}</span>
                <span className="font-medium">
                  {r.count} 家 ({r.percent}%)
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-400"
                  style={{ width: `${(r.count / maxRegionCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 border border-violet-300 text-violet-600 rounded-lg text-sm hover:bg-violet-50"
        >
          <Download size={15} />
          导出报表
        </button>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function DataPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("sales");
  const [showExportTip, setShowExportTip] = useState(false);

  function handleExport() {
    setShowExportTip(true);
    setTimeout(() => setShowExportTip(false), 3000);
  }

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据中心</h1>
          <p className="text-sm text-gray-500 mt-1">
            统一汇总各模块核心数据，支持多维分析
          </p>
        </div>
        {showExportTip && (
          <div className="flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-lg text-sm animate-pulse">
            <Download size={15} />
            导出功能开发中，敬请期待
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-gray-100 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <Info size={16} className="text-gray-400 mt-0.5 shrink-0" />
        <p className="text-sm text-gray-600">
          数据中心将在各模块数据积累后自动汇总，现展示示例报表。实际数据将在系统正式运营后自动同步。
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
        <div className="flex border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors border-b-2",
                activeTab === tab.key
                  ? "border-violet-600 text-violet-600 bg-violet-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "sales" && <SalesDashboard onExport={handleExport} />}
          {activeTab === "kol" && <KolDashboard onExport={handleExport} />}
          {activeTab === "content" && <ContentDashboard onExport={handleExport} />}
          {activeTab === "channel" && <ChannelDashboard onExport={handleExport} />}
        </div>
      </div>
    </div>
  );
}
