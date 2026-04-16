-- 用户档案表（扩展 Supabase 认证用户）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin','manager','ecommerce_op','kol_manager','content_op','channel_manager','service','finance','viewer')),
  department TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 工作任务表
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  module TEXT DEFAULT '',
  assignee_id UUID REFERENCES profiles(id),
  creator_id UUID REFERENCES profiles(id),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','review','completed','overdue')),
  due_date DATE,
  result TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 销售数据表（每日各平台数据）
CREATE TABLE IF NOT EXISTS sales_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('tianmao','jingdong','douyin','pinduoduo','other')),
  date DATE NOT NULL,
  gmv NUMERIC DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  refund_amount NUMERIC DEFAULT 0,
  ad_spend NUMERIC DEFAULT 0,
  visitor_count INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 达人档案表
CREATE TABLE IF NOT EXISTS kols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT DEFAULT '' CHECK (platform IN ('douyin','xiaohongshu','bilibili','weibo','kuaishou','other','')),
  followers_count INTEGER DEFAULT 0,
  category TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  wechat TEXT DEFAULT '',
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','contacted','negotiating','cooperating','published','reviewed','blacklist')),
  fee NUMERIC DEFAULT 0,
  cooperation_count INTEGER DEFAULT 0,
  avg_roi NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 达人合作记录表
CREATE TABLE IF NOT EXISTS kol_cooperations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  product TEXT DEFAULT '',
  fee NUMERIC DEFAULT 0,
  send_sample BOOLEAN DEFAULT false,
  publish_date DATE,
  publish_url TEXT DEFAULT '',
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  gmv NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','published','reviewed')),
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 内容选题表
CREATE TABLE IF NOT EXISTS content_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT DEFAULT '',
  type TEXT DEFAULT '' CHECK (type IN ('video','image','live','article','')),
  source TEXT DEFAULT '' CHECK (source IN ('hot','original','competitor','kol','')),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','producing','published','reviewed')),
  assignee_id UUID REFERENCES profiles(id),
  due_date DATE,
  publish_url TEXT DEFAULT '',
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 渠道门店表
CREATE TABLE IF NOT EXISTS channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT DEFAULT 'store' CHECK (type IN ('store','agent')),
  name TEXT NOT NULL,
  region TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  status TEXT DEFAULT 'lead'
    CHECK (status IN ('lead','negotiating','signed','active','inactive')),
  signed_date DATE,
  first_order_date DATE,
  monthly_gmv NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 客服工单表
CREATE TABLE IF NOT EXISTS service_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT DEFAULT 'aftersale'
    CHECK (type IN ('presale','aftersale','complaint','return','exchange','refund')),
  platform TEXT DEFAULT '',
  order_id TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  issue TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','processing','resolved','closed')),
  assignee_id UUID REFERENCES profiles(id),
  resolution TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 竞品表
CREATE TABLE IF NOT EXISTS competitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT DEFAULT '',
  platform TEXT DEFAULT '',
  shop_url TEXT DEFAULT '',
  price_range TEXT DEFAULT '',
  monthly_sales INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 新用户自动创建 profile 的触发器
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 开放读写权限（内部系统，暂不启用RLS）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE kols ENABLE ROW LEVEL SECURITY;
ALTER TABLE kol_cooperations ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- 登录用户可读写所有数据
CREATE POLICY "authenticated_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON sales_data FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON kols FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON kol_cooperations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON content_topics FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON channels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON service_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON competitors FOR ALL TO authenticated USING (true) WITH CHECK (true);
