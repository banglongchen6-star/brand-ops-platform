-- ============================================================================
-- 迁移：把老版 content_trends 结构补齐到新版
-- 老版（/content/trends 旧页面）字段：title/source/category/heat_score/description/related_url/tags/status
-- 新版（/content/workspace）需要：platform_slug/source_type/external_id/cover_url/
--   source_url/rank_on_list/hot_score/views/likes/comments/shares/music_score/
--   starred/read/analyzed/first_seen_at/last_seen_at/author/created_by
-- ============================================================================

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

-- source_type CHECK：如果老表有别的同名约束先放过，添加新约束（若已存在会静默失败，可忽略）
DO $$ BEGIN
  BEGIN
    ALTER TABLE content_trends
      ADD CONSTRAINT content_trends_source_type_check
      CHECK (source_type IN ('dailyhot','manual'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 去重键：platform_slug + external_id
CREATE UNIQUE INDEX IF NOT EXISTS uniq_content_trends_platform_ext
  ON content_trends (platform_slug, external_id)
  WHERE platform_slug IS NOT NULL;

-- 索引
CREATE INDEX IF NOT EXISTS idx_content_trends_platform_seen
  ON content_trends (platform_slug, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_trends_starred
  ON content_trends (starred) WHERE starred = true;
CREATE INDEX IF NOT EXISTS idx_content_trends_analyzed
  ON content_trends (analyzed) WHERE analyzed = true;

-- 继续 seed keywords（因为上一次整套 SQL 中途失败，词库可能没成功 insert）
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
