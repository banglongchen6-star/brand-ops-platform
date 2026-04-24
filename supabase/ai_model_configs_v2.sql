-- AI 模型配置（完整初始化脚本：建表 + v2 字段）
-- 幂等：重复执行不会破坏现有数据
-- scope 约定：
--   'global'  —— 全局默认（兜底），调用时 scope 未命中时回退
--   'content' —— 内容运营模块专属
--   未来其他模块：'sales' / 'kol' / 'channel' / 'service' / 'review' / ...

-- 1. 建表（首次执行会建，已存在则跳过）
CREATE TABLE IF NOT EXISTS ai_model_configs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider          TEXT NOT NULL CHECK (provider IN ('claude','qwen','openai_compat')),
  label             TEXT NOT NULL DEFAULT '',
  model             TEXT NOT NULL,
  base_url          TEXT NOT NULL DEFAULT '',
  api_key_encrypted TEXT NOT NULL,
  api_key_last4     TEXT NOT NULL DEFAULT '',
  is_active         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. v2 加字段
ALTER TABLE ai_model_configs
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'global';

ALTER TABLE ai_model_configs
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. 扔掉旧的唯一激活索引（如果有）
DROP INDEX IF EXISTS uniq_ai_config_active;

-- 4. 每个 scope 下最多一条 is_active
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_config_active_per_scope
  ON ai_model_configs (scope, is_active) WHERE is_active = true;

-- 5. scope 查询优化
CREATE INDEX IF NOT EXISTS idx_ai_config_scope
  ON ai_model_configs (scope);

-- 6. 开 RLS，拒绝所有 anon 访问（只 service_role 可操作）
ALTER TABLE ai_model_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_anon_all" ON ai_model_configs;
CREATE POLICY "deny_anon_all" ON ai_model_configs
  FOR ALL TO anon
  USING (false) WITH CHECK (false);

NOTIFY pgrst, 'reload schema';
