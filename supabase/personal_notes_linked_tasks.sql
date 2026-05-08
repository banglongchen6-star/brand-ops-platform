-- 笔记 → 任务 关联：一条笔记可以转成多条任务，记录所有关联的任务 id
ALTER TABLE personal_notes
  ADD COLUMN IF NOT EXISTS linked_task_ids uuid[] NOT NULL DEFAULT '{}';

-- 为按关联任务反查笔记的场景留索引（用 GIN 做数组包含查询）
CREATE INDEX IF NOT EXISTS idx_personal_notes_linked_task_ids
  ON personal_notes USING GIN (linked_task_ids);
