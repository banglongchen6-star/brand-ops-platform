-- 给 personal_notes 加拖拽排序字段
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_personal_notes_sort ON personal_notes(owner_id, category_id, sort_order NULLS LAST);
NOTIFY pgrst, 'reload schema';
