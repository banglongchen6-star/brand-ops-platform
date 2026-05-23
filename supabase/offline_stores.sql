-- 线下门店模块（渠道分销）
-- 单表存所有门店：品牌 / 门店名 / 地址 / 区域 / 备注

CREATE TABLE IF NOT EXISTS offline_stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand       TEXT NOT NULL DEFAULT '',     -- 品牌名（自由输入，前端按 hash 出颜色）
  name        TEXT NOT NULL,                -- 门店名称
  address     TEXT DEFAULT '',              -- 详细地址
  region      TEXT DEFAULT '',              -- 区域（省/市，自由输入）
  notes       TEXT DEFAULT '',              -- 备注
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_stores_brand  ON offline_stores(brand);
CREATE INDEX IF NOT EXISTS idx_offline_stores_region ON offline_stores(region);
CREATE INDEX IF NOT EXISTS idx_offline_stores_created ON offline_stores(created_at DESC);

-- RLS 关闭，API 层做用户校验
ALTER TABLE offline_stores DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
