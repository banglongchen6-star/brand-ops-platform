-- P4 公众号发布补丁：
-- 1. wx_publish_configs 加 access_token 缓存列
-- 2. wx_articles 加 publish 相关索引

ALTER TABLE wx_publish_configs
  ADD COLUMN IF NOT EXISTS access_token       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS token_expires_at   TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
