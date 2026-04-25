-- 「文字内容」模块：公众号文章 AI 写作 + 推送
-- 3 张表：wx_publish_configs（账号配置）/ wx_articles（文章）/ wx_article_images（配图）
-- 幂等：CREATE IF NOT EXISTS + DO NOTHING

-- ============ 1. 公众号配置 ============
CREATE TABLE IF NOT EXISTS wx_publish_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,                       -- 备注名，如「音乐密码服务号」
  app_id          TEXT NOT NULL,                       -- 微信 AppID
  app_secret_enc  TEXT NOT NULL,                       -- AES-256-GCM 加密后的 AppSecret
  account_type    TEXT NOT NULL DEFAULT 'service',     -- service=企业服务号 / subscription=订阅号
  default_author  TEXT DEFAULT '',                     -- 默认作者署名
  enabled         BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============ 2. 文章主表 ============
CREATE TABLE IF NOT EXISTS wx_articles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_config_id   UUID REFERENCES wx_publish_configs(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'draft',
    -- draft（起草中）/ ai_writing（AI写作中）/ ready（待发）/
    -- scheduled（已定时）/ published（已发布）/ failed（失败）
  current_step        SMALLINT DEFAULT 1,              -- 8步流程当前步骤（1-8）

  -- 选题
  ai_topic_input      TEXT DEFAULT '',                 -- 用户输入的选题方向/补充背景
  source_trend_id     UUID,                            -- 关联的热点 content_trends.id（可空）
  source_topic        TEXT DEFAULT '',                 -- 选题文案
  source_angle        TEXT DEFAULT '',                 -- 文章角度

  -- 大纲与正文
  ai_outline          JSONB,                           -- {intro, sections:[{heading,keypoint,examples}], conclusion}
  content_md          TEXT DEFAULT '',                 -- Markdown 草稿
  content_html        TEXT DEFAULT '',                 -- 最终排版 HTML

  -- 标题/摘要
  title               TEXT DEFAULT '',
  ai_title_options    JSONB,                           -- [{title,style,emoji_used}]
  digest              TEXT DEFAULT '',                 -- 摘要（约120字）
  author              TEXT DEFAULT '',

  -- 封面
  cover_image_url     TEXT DEFAULT '',
  thumb_media_id      TEXT DEFAULT '',                 -- 封面上传微信后的 media_id

  -- 发布
  wx_draft_media_id   TEXT DEFAULT '',                 -- 草稿推送后微信返回的 media_id
  wx_article_url      TEXT DEFAULT '',                 -- 发布后微信返回的文章 URL
  scheduled_at        TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  publish_error       TEXT DEFAULT '',                 -- 发布失败时的错误信息

  -- 统计
  word_count          INTEGER DEFAULT 0,
  reading_time_min    INTEGER DEFAULT 0,

  -- 元数据
  created_by          UUID,                            -- profiles.id
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wx_articles_status      ON wx_articles(status);
CREATE INDEX IF NOT EXISTS idx_wx_articles_created_at  ON wx_articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wx_articles_scheduled   ON wx_articles(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- ============ 3. 文章配图 ============
CREATE TABLE IF NOT EXISTS wx_article_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  UUID NOT NULL REFERENCES wx_articles(id) ON DELETE CASCADE,
  position    TEXT NOT NULL,                           -- cover / body_1 / body_2 / body_3
  prompt_zh   TEXT DEFAULT '',                         -- 中文提示词（可编辑）
  prompt_en   TEXT DEFAULT '',                         -- 英文提示词（可选）
  aspect      TEXT DEFAULT '16:9',                     -- 16:9 / 1:1 / 3:4
  image_url   TEXT DEFAULT '',                         -- 通义万相生成图URL
  wx_media_id TEXT DEFAULT '',                         -- 上传微信永久素材后的 media_id
  status      TEXT NOT NULL DEFAULT 'pending',         -- pending / generating / done / failed
  error       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wx_article_images_article ON wx_article_images(article_id);

-- 关 RLS（内部后台）
ALTER TABLE wx_publish_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE wx_articles        DISABLE ROW LEVEL SECURITY;
ALTER TABLE wx_article_images  DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
