-- 修复：content_trends 的唯一索引是部分索引（WHERE platform_slug IS NOT NULL）
-- PostgREST upsert onConflict 不认部分索引，需要改成完整 UNIQUE CONSTRAINT

BEGIN;

-- 1. 清理可能的脏数据（platform_slug 为空的行）
DELETE FROM content_trends WHERE platform_slug IS NULL;

-- 2. 把 platform_slug 设为 NOT NULL（后续不允许空）
ALTER TABLE content_trends ALTER COLUMN platform_slug SET NOT NULL;

-- 3. 若存在同一 (platform_slug, external_id) 的重复行，只保留最新的
DELETE FROM content_trends a
USING content_trends b
WHERE a.platform_slug = b.platform_slug
  AND a.external_id   = b.external_id
  AND a.id <> b.id
  AND a.last_seen_at < b.last_seen_at;

-- 4. 删除老的部分唯一索引
DROP INDEX IF EXISTS uniq_content_trends_platform_ext;

-- 5. 创建真正的 UNIQUE CONSTRAINT（PostgREST upsert 需要）
ALTER TABLE content_trends
  ADD CONSTRAINT content_trends_platform_ext_unique
  UNIQUE (platform_slug, external_id);

COMMIT;

NOTIFY pgrst, 'reload schema';
