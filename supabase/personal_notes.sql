-- 个人工作笔记（首页用）—— 一天多条命名笔记
-- 完全私人：靠 owner_id 隔离，service role 写入，前端只走带鉴权 API

CREATE TABLE IF NOT EXISTS personal_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,    -- 笔记所属日期（顶部切换用）
  title         TEXT NOT NULL DEFAULT '速记',          -- 笔记标题（默认"速记"，用户可改）
  content_md    TEXT DEFAULT '',                       -- Markdown 正文
  tags          JSONB NOT NULL DEFAULT '[]'::jsonb,    -- 解析自 #标签（暂时备用）
  is_archived   BOOLEAN DEFAULT false,
  -- 用于 AI dedup：上一次 detect 时正文长度 + 简单哈希，避免重复检测
  last_detect_len    INTEGER DEFAULT 0,
  last_detect_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_notes_owner_date  ON personal_notes(owner_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_personal_notes_updated     ON personal_notes(owner_id, updated_at DESC);

-- 关 RLS（API 层做用户隔离）
ALTER TABLE personal_notes DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
