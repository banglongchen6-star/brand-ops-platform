-- 竞品情报模块 Phase 1
-- 扩展现有 competitors 表 + 新增 SKU / 快照 / 事件 / 报告 4 张表

-- 1. 扩展 competitors 表
ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS category         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_position   TEXT DEFAULT '',     -- 高端/中端/性价比
  ADD COLUMN IF NOT EXISTS followers        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority         SMALLINT DEFAULT 3,  -- 1-5 关注度
  ADD COLUMN IF NOT EXISTS is_self          BOOLEAN DEFAULT false, -- 是否「我们品牌」
  ADD COLUMN IF NOT EXISTS is_archived      BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_competitors_platform ON competitors(platform);
CREATE INDEX IF NOT EXISTS idx_competitors_self     ON competitors(is_self) WHERE is_self = true;

-- 2. 竞品 SKU
CREATE TABLE IF NOT EXISTS competitor_skus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  product_url     TEXT DEFAULT '',
  category        TEXT DEFAULT '',                    -- 商品细分品类
  current_price   NUMERIC(10, 2),                     -- 当前价
  original_price  NUMERIC(10, 2),                     -- 原价
  current_sales   INTEGER DEFAULT 0,                  -- 累计销量
  monthly_sales   INTEGER DEFAULT 0,                  -- 月销
  rating          NUMERIC(3, 2),                      -- 评分 0-5
  review_count    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active',              -- active / discontinued / new
  is_hot          BOOLEAN DEFAULT false,              -- 爆款标记
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_competitor_skus_competitor ON competitor_skus(competitor_id);

-- 3. SKU 数据快照（趋势图核心）
CREATE TABLE IF NOT EXISTS competitor_sku_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id          UUID NOT NULL REFERENCES competitor_skus(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,                      -- 快照日期
  price           NUMERIC(10, 2),
  sales           INTEGER,                            -- 累计销量
  monthly_sales   INTEGER,
  rating          NUMERIC(3, 2),
  review_count    INTEGER,
  in_stock        BOOLEAN DEFAULT true,
  notes           TEXT DEFAULT '',
  recorded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sku_snapshots_sku_date ON competitor_sku_snapshots(sku_id, snapshot_date DESC);

-- 4. 重要事件（上新/调价/促销/直播/联名）
CREATE TABLE IF NOT EXISTS competitor_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  related_sku_id  UUID REFERENCES competitor_skus(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,                      -- new_product / price_change / promotion / livestream / collab / other
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  event_date      DATE NOT NULL,
  impact_level    TEXT DEFAULT 'medium',              -- high / medium / low
  notes           TEXT DEFAULT '',
  recorded_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_competitor_events_competitor ON competitor_events(competitor_id, event_date DESC);

-- 5. AI 周/月报存档（P2 用）
CREATE TABLE IF NOT EXISTS competitor_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID REFERENCES profiles(id),
  report_type     TEXT NOT NULL DEFAULT 'weekly',     -- weekly / monthly / on_demand
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  content_md      TEXT NOT NULL DEFAULT '',
  highlights      JSONB,                              -- AI 提取的核心要点
  competitor_ids  UUID[],                             -- 报告涉及的竞品
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_competitor_reports_period ON competitor_reports(period_end DESC);

-- 关 RLS（API 层做用户校验）
ALTER TABLE competitor_skus            DISABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_sku_snapshots   DISABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_events          DISABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_reports         DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
