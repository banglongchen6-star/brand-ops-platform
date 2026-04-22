-- ============================================================================
-- 内容运营工作台 · 完整建表（幂等）
-- 先迁移老版 content_trends，再建其余 6 张新表 + 种子
-- ============================================================================

-- 1. 补齐 content_trends 老表字段 -------------------------------------------
ALTER TABLE content_trends
  ADD COLUMN IF NOT EXISTS platform_slug TEXT,
  ADD COLUMN IF NOT EXISTS source_type   TEXT NOT NULL DEFAULT 'dailyhot',
  ADD COLUMN IF NOT EXISTS external_id   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS author        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cover_url     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS rank_on_list  INTEGER,
  ADD COLUMN IF NOT EXISTS hot_score     BIGINT,
  ADD COLUMN IF NOT EXISTS views         BIGINT,
  ADD COLUMN IF NOT EXISTS likes         BIGINT,
  ADD COLUMN IF NOT EXISTS comments      BIGINT,
  ADD COLUMN IF NOT EXISTS shares        BIGINT,
  ADD COLUMN IF NOT EXISTS music_score   SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starred       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS analyzed      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by    UUID REFERENCES profiles(id);

DO $$ BEGIN
  BEGIN
    ALTER TABLE content_trends
      ADD CONSTRAINT content_trends_source_type_check
      CHECK (source_type IN ('dailyhot','manual'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_content_trends_platform_ext
  ON content_trends (platform_slug, external_id)
  WHERE platform_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_trends_platform_seen
  ON content_trends (platform_slug, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_trends_starred
  ON content_trends (starred) WHERE starred = true;
CREATE INDEX IF NOT EXISTS idx_content_trends_analyzed
  ON content_trends (analyzed) WHERE analyzed = true;

-- 2. 平台配置 ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_platforms (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  color_class TEXT NOT NULL DEFAULT 'bg-gray-500 text-white',
  source      TEXT NOT NULL DEFAULT 'manual'
              CHECK (source IN ('dailyhot','manual')),
  enabled     BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  link_format TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. AI 拆解结果 ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_hit_factors (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_id            UUID NOT NULL REFERENCES content_trends(id) ON DELETE CASCADE,
  hook                TEXT DEFAULT '',
  structure           TEXT DEFAULT '',
  emotion             TEXT DEFAULT '',
  topic_angle         TEXT DEFAULT '',
  audience            TEXT DEFAULT '',
  format              TEXT DEFAULT '',
  replicable_elements TEXT DEFAULT '',
  adaptation_advice   TEXT DEFAULT '',
  difficulty          SMALLINT DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  tags                TEXT[] DEFAULT '{}',
  raw_json            JSONB,
  analyzed_by         UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hit_factors_trend
  ON content_hit_factors (trend_id);

-- 4. 关键词库 ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_keyword_library (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category   TEXT NOT NULL DEFAULT 'music'
             CHECK (category IN ('music','brand','custom','negative')),
  keyword    TEXT NOT NULL,
  weight     SMALLINT NOT NULL DEFAULT 5 CHECK (weight BETWEEN 1 AND 10),
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, keyword)
);

-- 5. 候选池 ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_candidate_pool (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_id   UUID NOT NULL REFERENCES content_trends(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL DEFAULT 'personal'
             CHECK (scope IN ('personal','team')),
  note       TEXT DEFAULT '',
  owner_id   UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trend_id, owner_id, scope)
);
CREATE INDEX IF NOT EXISTS idx_candidate_pool_owner
  ON content_candidate_pool (owner_id, scope);

-- 6. 套路库 ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_tropes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category    TEXT NOT NULL
              CHECK (category IN ('hook','structure','emotion','format')),
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  usage_count INTEGER NOT NULL DEFAULT 0,
  source_ids  UUID[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, title)
);

-- 7. 工作台通用设置 ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_workspace_settings (
  user_id            UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  refresh_interval   INTEGER NOT NULL DEFAULT 0,
  default_density    TEXT NOT NULL DEFAULT 'card' CHECK (default_density IN ('card','list')),
  default_pool_scope TEXT NOT NULL DEFAULT 'personal' CHECK (default_pool_scope IN ('personal','team')),
  desktop_notify     BOOLEAN NOT NULL DEFAULT false,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 种子数据
-- ============================================================================

INSERT INTO content_platforms (slug, name, color_class, source, enabled, sort_order) VALUES
  ('douyin',      '抖音',   'bg-black text-white',        'dailyhot', true,  1),
  ('xiaohongshu', '小红书', 'bg-rose-500 text-white',     'manual',   true,  2),
  ('weibo',       '微博',   'bg-orange-500 text-white',   'dailyhot', true,  3),
  ('bilibili',    'B站',    'bg-pink-400 text-white',     'dailyhot', true,  4),
  ('zhihu',       '知乎',   'bg-blue-500 text-white',     'dailyhot', true,  5),
  ('shipinhao',   '视频号', 'bg-green-500 text-white',    'manual',   false, 6),
  ('weixin',      '公众号', 'bg-emerald-600 text-white',  'manual',   false, 7)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO content_keyword_library (category, keyword, weight) VALUES
  ('music', '音乐',     10),
  ('music', '乐器',     10),
  ('music', '钢琴',     9),
  ('music', '吉他',     9),
  ('music', '尤克里里', 8),
  ('music', '鼓',       7),
  ('music', '唱',       6),
  ('music', '歌',       6),
  ('music', '编曲',     8),
  ('music', '作曲',     8),
  ('music', '翻唱',     8),
  ('music', '演奏',     7),
  ('brand', '音乐密码', 10),
  ('custom','智能乐器', 8)
ON CONFLICT (category, keyword) DO NOTHING;

NOTIFY pgrst, 'reload schema';
