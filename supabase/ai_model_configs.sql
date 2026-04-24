-- AI 模型配置表：支持 Claude / 千问 / 自定义 OpenAI 兼容
-- API Key 存加密密文（AES-256-GCM），只允许服务端 service_role 读写

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

-- 唯一激活：只允许一条 is_active=true
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_config_active
  ON ai_model_configs (is_active) WHERE is_active = true;

-- 启用 RLS 并拒绝所有 anon 访问（仅 service_role 能操作）
ALTER TABLE ai_model_configs ENABLE ROW LEVEL SECURITY;

-- 清理可能存在的旧策略
DROP POLICY IF EXISTS "deny_anon_all" ON ai_model_configs;

-- 默认无策略 = anon 完全禁止；明确一条 deny 便于阅读
CREATE POLICY "deny_anon_all" ON ai_model_configs
  FOR ALL TO anon
  USING (false) WITH CHECK (false);

NOTIFY pgrst, 'reload schema';
