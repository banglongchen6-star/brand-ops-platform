-- 每条笔记加"推送摘要"字段
-- 填了 → 推送内容用摘要；留空 → 仍用笔记完整 content_md
-- 幂等可重跑

ALTER TABLE personal_notes
  ADD COLUMN IF NOT EXISTS push_summary TEXT DEFAULT '';

NOTIFY pgrst, 'reload schema';
