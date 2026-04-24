-- 补齐 content_hit_factors 所有字段（幂等）
-- 解决老版本建表缺少 adaptation_advice / replicable_elements 等字段的问题
-- 重复执行无副作用

ALTER TABLE content_hit_factors
  ADD COLUMN IF NOT EXISTS hook                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS structure           TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS emotion             TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS topic_angle         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS audience            TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS format              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS replicable_elements TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS adaptation_advice   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS difficulty          SMALLINT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS tags                TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS raw_json            JSONB,
  ADD COLUMN IF NOT EXISTS analyzed_by         UUID,
  ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

NOTIFY pgrst, 'reload schema';
