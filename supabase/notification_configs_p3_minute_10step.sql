-- 推送时间分钟粒度从 30 分钟 → 10 分钟
-- 既要改 personal_notes.push_minute 的 CHECK，也要改 notification_configs.push_minute
-- 幂等可重跑

-- ============ 1. personal_notes ============
DO $$ BEGIN
  -- 删旧约束
  BEGIN
    ALTER TABLE personal_notes DROP CONSTRAINT IF EXISTS personal_notes_push_minute_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- 加新约束
  BEGIN
    ALTER TABLE personal_notes ADD CONSTRAINT personal_notes_push_minute_check
      CHECK (push_minute IS NULL OR push_minute IN (0, 10, 20, 30, 40, 50));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============ 2. notification_configs（兼容老字段，虽然 cron 已不再用） ============
DO $$ BEGIN
  BEGIN
    ALTER TABLE notification_configs DROP CONSTRAINT IF EXISTS notification_configs_push_minute_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE notification_configs ADD CONSTRAINT notification_configs_push_minute_check
      CHECK (push_minute IS NULL OR push_minute IN (0, 10, 20, 30, 40, 50));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
