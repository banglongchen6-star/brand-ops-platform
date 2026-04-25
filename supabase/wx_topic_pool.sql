-- 选题素材库 + 选题日历（Phase 1）
-- 一张表搞定：候选 / 排期 / 已采用 / 废弃 多状态切换

CREATE TABLE IF NOT EXISTS wx_topic_pool (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 核心内容
  title             TEXT NOT NULL,                       -- 选题方向（不一定是最终标题）
  pain_point        TEXT DEFAULT '',                     -- 切入的痛点
  target_audience   TEXT DEFAULT '',                     -- 目标人群
  angle             TEXT DEFAULT '',                     -- 切入角度建议
  reference_notes   TEXT DEFAULT '',                     -- 参考资料/灵感来源/竞品链接等

  -- 标签（数组）
  tags              JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["季节-暑期", "痛点-学不会", "卖点-30天体验课"]

  -- 状态机
  status            TEXT NOT NULL DEFAULT 'candidate',
                                                         -- candidate（候选）/ scheduled（已排期）
                                                         -- used（已采用，关联了 article）/ discarded（弃用）
  priority          SMALLINT DEFAULT 3,                  -- 1-5，5 最高

  -- 排期（日历视图用，date 类型，不带时间）
  scheduled_at      DATE,

  -- 关联
  article_id        UUID REFERENCES wx_articles(id) ON DELETE SET NULL,
                                                         -- 用了之后关联到生成的文章

  -- 来源
  source_type       TEXT DEFAULT 'manual',
                                                         -- manual / ai / competitor / student_question / trend
  source_ref        TEXT DEFAULT '',                     -- 来源 ID / 链接 / 备注

  -- 元数据
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wx_topic_pool_status     ON wx_topic_pool(status);
CREATE INDEX IF NOT EXISTS idx_wx_topic_pool_scheduled  ON wx_topic_pool(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wx_topic_pool_created    ON wx_topic_pool(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wx_topic_pool_article    ON wx_topic_pool(article_id) WHERE article_id IS NOT NULL;

ALTER TABLE wx_topic_pool DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
