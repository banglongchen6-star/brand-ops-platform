-- 个人笔记分类表（每个用户自己的板块，可编辑）
-- 首次访问首页时 API 会自动种入 5 个默认板块（电商/达人/内容/渠道/客服）
-- 用户可重命名、改 emoji、增删、排序

CREATE TABLE IF NOT EXISTS note_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '📝',          -- emoji
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_categories_owner
  ON note_categories(owner_id, sort_order);

-- 笔记关联板块（FK 形式）
ALTER TABLE personal_notes
  ADD COLUMN IF NOT EXISTS category_id UUID
    REFERENCES note_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personal_notes_category_id
  ON personal_notes(owner_id, category_id, updated_at DESC);

-- 关 RLS
ALTER TABLE note_categories DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
