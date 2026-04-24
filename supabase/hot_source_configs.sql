-- 热点来源配置表：集中管理所有数据源的 API 地址和启用状态
-- 幂等：CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING

CREATE TABLE IF NOT EXISTS hot_source_configs (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  api_url     TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  notes       TEXT DEFAULT '',
  sort_order  INTEGER DEFAULT 99,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 种两条默认来源
INSERT INTO hot_source_configs (slug, name, api_url, enabled, notes, sort_order) VALUES
  ('trendradar', 'TrendRadar（newsnow 聚合）', 'https://newsnow.busiyi.world/api', true,
   '聚合 40+ 平台热榜。默认使用公共 demo 实例；建议部署自己的 newsnow 后在此处替换 URL。', 10),
  ('dailyhot',   'DailyHot（imsyy.top）',       'https://api-hot.imsyy.top',         true,
   '老牌热榜聚合。近期不稳定，常见 fetch failed。', 20)
ON CONFLICT (slug) DO NOTHING;

-- 内部后台，关 RLS
ALTER TABLE hot_source_configs DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
