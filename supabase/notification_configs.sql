-- 笔记推送通知模块
-- 1) notification_configs：每个用户一行，存 PushPlus token + 推送时间设置
-- 2) personal_notes 加 push_enabled 字段：标了铃铛的笔记会被推送
-- 幂等可重跑

-- ============ 1. 用户推送配置 ============
CREATE TABLE IF NOT EXISTS notification_configs (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  pushplus_token_enc TEXT DEFAULT '',        -- AES-256-GCM 加密后的 PushPlus token（base64）
  pushplus_token_last4 TEXT DEFAULT '',      -- UI 仅显示末 4 位
  enabled BOOLEAN DEFAULT false,             -- 总开关
  frequency TEXT DEFAULT 'daily'
    CHECK (frequency IN ('daily','weekly')),
  push_hour SMALLINT DEFAULT 9               -- 0-23
    CHECK (push_hour BETWEEN 0 AND 23),
  push_minute SMALLINT DEFAULT 0             -- UI 仅允许 0 / 30（与 cron 频率对齐）
    CHECK (push_minute IN (0, 30)),
  push_weekday SMALLINT                      -- 1-7（Mon=1..Sun=7），weekly 时必填
    CHECK (push_weekday IS NULL OR push_weekday BETWEEN 1 AND 7),
  last_pushed_at TIMESTAMPTZ,                -- 防止同一时间窗口重复推送
  last_error TEXT DEFAULT '',                -- 最后一次推送出错原因（便于排查）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notification_configs DISABLE ROW LEVEL SECURITY;

-- ============ 2. 笔记加铃铛字段 ============
ALTER TABLE personal_notes
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_personal_notes_push_enabled
  ON personal_notes(owner_id) WHERE push_enabled = true;

NOTIFY pgrst, 'reload schema';
