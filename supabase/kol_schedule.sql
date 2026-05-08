-- 达人排期表模块 · M1
-- 5 张表：kol_schedules（主） + schedule_categories（类目字典）
--        + schedule_directions（方向字典） + schedule_budgets（月预算，M3 用）
--        + schedule_import_logs（导入日志，M2 用）
-- 幂等可重跑（IF NOT EXISTS / ON CONFLICT DO NOTHING）

-- ============ 1. 类目字典 ============
CREATE TABLE IF NOT EXISTS schedule_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL DEFAULT '',
  default_platform TEXT DEFAULT '',
  default_directions JSONB DEFAULT '[]'::jsonb,
  default_requirements TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE schedule_categories DISABLE ROW LEVEL SECURITY;

INSERT INTO schedule_categories (name, short_name, default_platform, default_directions, default_requirements, sort_order) VALUES
  ('头部优质音乐博主',   '头部',      '抖音为主', '["弹唱","弹奏"]',                 '品牌背书,曝光,粉丝粘性',                          1),
  ('腰部（其他类）',     '腰部',      '抖音为主', '["弹唱","生活","教学"]',          '内容好,传递情绪价值,1/弹唱',                       2),
  ('优质弹唱',           '优质',      '抖音',     '["弹奏","弹唱","鼓棒"]',          '1/弹奏 2/弹唱 3/单独鼓槌·产品特性体现',           3),
  ('尾部弹奏弹唱',       '尾部',      '全平台',   '["弹奏","弹唱","鼓棒"]',          '鼓槌至少出现10条·4条/人/月·500/条',                4),
  ('种草通投流',         '种草·投流', '抖音为主', '["种草","测评"]',                 '测评类·好物分享·要长期投',                         5),
  ('基础（奖励）',       '基础',      '抖音为主', '["弹唱","弹奏","教学","亲子"]',   '俗人账号·均播1w+·有过爆款·创新强',                 6),
  ('种草好物测评·抖',    '好物·抖',   '抖音',     '["种草","口播"]',                 '口播·把鼓槌加进去·1000/条',                        7),
  ('种草好物测评·红',    '好物·红',   '小红书',   '["种草","口播"]',                 '口播·把鼓槌加进去',                                8),
  ('奖励费',             '奖励',      '',         '["弹奏","弹唱","乐队"]',          '1/弹奏 2/弹唱 3/乐队',                             9),
  ('维护 水军',          '维护',      '',         '[]',                              '每条作品自评必刷评',                              10),
  ('置换',               '置换',      '全平台',   '[]',                              '',                                                11)
ON CONFLICT (name) DO NOTHING;

-- ============ 2. 方向字典 ============
CREATE TABLE IF NOT EXISTS schedule_directions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE schedule_directions DISABLE ROW LEVEL SECURITY;

INSERT INTO schedule_directions (name, sort_order) VALUES
  ('弹唱', 1), ('弹奏', 2), ('鼓棒', 3), ('生活', 4),
  ('教学', 5), ('亲子', 6), ('种草', 7), ('口播', 8),
  ('测评', 9), ('乐队', 10), ('剧情', 11), ('Vlog', 12)
ON CONFLICT (name) DO NOTHING;

-- ============ 3. 排期主表 ============
CREATE TABLE IF NOT EXISTS kol_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_date DATE NOT NULL,
  category TEXT NOT NULL,
  category_direction TEXT DEFAULT '',
  tier TEXT DEFAULT ''
    CHECK (tier IN ('头部','中部','腰部','尾部','素人','')),
  kol_name TEXT NOT NULL,
  kol_id UUID REFERENCES kols(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform TEXT DEFAULT '',
  status TEXT DEFAULT 'planned'
    CHECK (status IN ('planned','contacted','confirmed','published','settled','cancelled')),
  publish_url TEXT DEFAULT '',
  publish_date DATE,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_date     ON kol_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_category ON kol_schedules(category);
CREATE INDEX IF NOT EXISTS idx_schedule_tier     ON kol_schedules(tier);
CREATE INDEX IF NOT EXISTS idx_schedule_kol      ON kol_schedules(kol_id);
CREATE INDEX IF NOT EXISTS idx_schedule_year_month
  ON kol_schedules(date_trunc('month', schedule_date));

ALTER TABLE kol_schedules DISABLE ROW LEVEL SECURITY;

-- ============ 4. 月预算（M3 用，先建好） ============
CREATE TABLE IF NOT EXISTS schedule_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  category TEXT NOT NULL,
  budget_amount NUMERIC(10,2) DEFAULT 0,
  target_count INTEGER,
  platform TEXT DEFAULT '',
  requirements TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month, category)
);
ALTER TABLE schedule_budgets DISABLE ROW LEVEL SECURITY;

-- ============ 5. 导入日志（M2 用，先建好） ============
CREATE TABLE IF NOT EXISTS schedule_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  imported_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE schedule_import_logs DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
