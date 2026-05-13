-- 每条笔记自己的推送时间/频率
-- 用户原本在「系统设置 → 消息推送」配的全局 frequency / push_hour / push_minute
-- 重构后：每条笔记自己存这 4 个字段。系统设置只留 token + 总开关。
-- 幂等可重跑

ALTER TABLE personal_notes
  ADD COLUMN IF NOT EXISTS push_frequency TEXT DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS push_hour SMALLINT DEFAULT 9,
  ADD COLUMN IF NOT EXISTS push_minute SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_weekday SMALLINT;

-- 加 check 约束（IF NOT EXISTS 不支持 constraint，用 DO 块兜底）
DO $$ BEGIN
  BEGIN
    ALTER TABLE personal_notes ADD CONSTRAINT personal_notes_push_frequency_check
      CHECK (push_frequency IN ('daily','weekly'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE personal_notes ADD CONSTRAINT personal_notes_push_hour_check
      CHECK (push_hour IS NULL OR (push_hour BETWEEN 0 AND 23));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE personal_notes ADD CONSTRAINT personal_notes_push_minute_check
      CHECK (push_minute IS NULL OR push_minute IN (0, 30));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE personal_notes ADD CONSTRAINT personal_notes_push_weekday_check
      CHECK (push_weekday IS NULL OR (push_weekday BETWEEN 1 AND 7));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
