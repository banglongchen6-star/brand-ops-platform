-- TrendRadar (newsnow) 平台接入：一次性把 37 个新平台种入 content_platforms
-- source='trendradar' 走新的同步分支（从 newsnow /api/s?id=<slug>&latest 拉取）
-- 现有 7 个平台（抖音/小红书/微博/B站/知乎/视频号/公众号）不动
-- 所有新平台默认 enabled=false，运营按需在 UI 里开启
-- 幂等：重复执行不会重复插入（靠 slug 唯一约束 + ON CONFLICT DO NOTHING）

-- 0. 先放宽 source 字段的 CHECK 约束，让它接受 trendradar
ALTER TABLE content_platforms DROP CONSTRAINT IF EXISTS content_platforms_source_check;
ALTER TABLE content_platforms
  ADD CONSTRAINT content_platforms_source_check
  CHECK (source IN ('dailyhot', 'manual', 'trendradar'));

INSERT INTO content_platforms (slug, name, color_class, source, enabled, sort_order) VALUES
  -- 中文主流资讯
  ('baidu',                  '百度热搜',   'bg-blue-500 text-white',   'trendradar', false, 10),
  ('toutiao',                '今日头条',   'bg-rose-500 text-white',   'trendradar', false, 11),
  ('tieba',                  '百度贴吧',   'bg-blue-500 text-white',   'trendradar', false, 12),
  ('thepaper',               '澎湃新闻',   'bg-gray-700 text-white',   'trendradar', false, 13),
  ('ifeng',                  '凤凰网',     'bg-orange-500 text-white', 'trendradar', false, 14),
  ('tencent-hot',            '腾讯新闻',   'bg-blue-500 text-white',   'trendradar', false, 15),
  ('hupu',                   '虎扑',       'bg-rose-500 text-white',   'trendradar', false, 16),
  ('kuaishou',               '快手',       'bg-amber-500 text-white',  'trendradar', false, 17),

  -- 科技/极客
  ('ithome',                 'IT之家',     'bg-rose-500 text-white',   'trendradar', false, 20),
  ('36kr-quick',             '36氪',       'bg-blue-500 text-white',   'trendradar', false, 21),
  ('juejin',                 '稀土掘金',   'bg-blue-500 text-white',   'trendradar', false, 22),
  ('sspai',                  '少数派',     'bg-rose-500 text-white',   'trendradar', false, 23),
  ('v2ex',                   'V2EX',       'bg-gray-700 text-white',   'trendradar', false, 24),
  ('coolapk',                '酷安',       'bg-green-500 text-white',  'trendradar', false, 25),
  ('solidot',                'Solidot',    'bg-gray-700 text-white',   'trendradar', false, 26),
  ('hackernews',             'Hacker News','bg-orange-500 text-white', 'trendradar', false, 27),
  ('producthunt',            'Product Hunt','bg-rose-500 text-white',  'trendradar', false, 28),
  ('github-trending-today',  'GitHub Trending','bg-black text-white',  'trendradar', false, 29),

  -- 财经
  ('wallstreetcn-quick',     '华尔街见闻', 'bg-blue-500 text-white',   'trendradar', false, 30),
  ('cls-hot',                '财联社',     'bg-rose-500 text-white',   'trendradar', false, 31),
  ('xueqiu',                 '雪球',       'bg-rose-500 text-white',   'trendradar', false, 32),
  ('gelonghui',              '格隆汇',     'bg-blue-500 text-white',   'trendradar', false, 33),
  ('jin10',                  '金十数据',   'bg-amber-500 text-white',  'trendradar', false, 34),
  ('fastbull-express',       '法布财经',   'bg-blue-500 text-white',   'trendradar', false, 35),
  ('mktnews-flash',          'MKTNews',    'bg-purple-500 text-white', 'trendradar', false, 36),

  -- 国际/世界
  ('zaobao',                 '联合早报',   'bg-rose-500 text-white',   'trendradar', false, 40),
  ('cankaoxiaoxi',           '参考消息',   'bg-rose-500 text-white',   'trendradar', false, 41),
  ('sputniknewscn',          '卫星通讯社', 'bg-orange-500 text-white', 'trendradar', false, 42),
  ('kaopu',                  '靠谱新闻',   'bg-gray-700 text-white',   'trendradar', false, 43),

  -- 影视/娱乐/兴趣
  ('qqvideo',                '腾讯视频',   'bg-blue-500 text-white',   'trendradar', false, 50),
  ('iqiyi',                  '爱奇艺',     'bg-green-500 text-white',  'trendradar', false, 51),
  ('douban',                 '豆瓣',       'bg-green-500 text-white',  'trendradar', false, 52),
  ('steam',                  'Steam',      'bg-gray-700 text-white',   'trendradar', false, 53),

  -- 职业/社区
  ('nowcoder',               '牛客',       'bg-green-500 text-white',  'trendradar', false, 60),
  ('chongbuluo-hot',         '虫部落',     'bg-rose-500 text-white',   'trendradar', false, 61),
  ('pcbeta-windows11',       '远景论坛',   'bg-blue-500 text-white',   'trendradar', false, 62),
  ('freebuf',                'Freebuf',    'bg-rose-500 text-white',   'trendradar', false, 63)
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
