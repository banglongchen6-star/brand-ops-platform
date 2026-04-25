-- P2 配图生成补丁：
--   1. wx_article_images 加 task_id 列（DashScope 异步任务 ID）
--   2. 创建 storage bucket 'wx-article-images' 持久化生成的图（DashScope URL 24h 过期）

-- 1. 加 task_id 列
ALTER TABLE wx_article_images
  ADD COLUMN IF NOT EXISTS task_id TEXT DEFAULT '';

-- 2. 建公开图床 bucket（如已存在则忽略）
INSERT INTO storage.buckets (id, name, public)
VALUES ('wx-article-images', 'wx-article-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. 允许 service_role 写、所有人读
DROP POLICY IF EXISTS "wx_images_public_read" ON storage.objects;
CREATE POLICY "wx_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wx-article-images');

DROP POLICY IF EXISTS "wx_images_service_write" ON storage.objects;
CREATE POLICY "wx_images_service_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wx-article-images');

NOTIFY pgrst, 'reload schema';
