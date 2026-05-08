-- 月度规划表新增「功能展示」列（战略意图/作用，区别于"要求"=执行细节）
-- 跟 platform/requirements 走相同 override 模式：
--   schedule_categories.default_function_display    字典层默认值
--   schedule_budgets.function_display               当月覆盖值
-- 幂等可重跑

ALTER TABLE schedule_categories
  ADD COLUMN IF NOT EXISTS default_function_display TEXT DEFAULT '';

ALTER TABLE schedule_budgets
  ADD COLUMN IF NOT EXISTS function_display TEXT DEFAULT '';

-- 给已有 11 个种子类目补一份"功能展示"默认内容（来自 HANDOFF 表 §2.3）
-- 已经有非空值的不动
UPDATE schedule_categories SET default_function_display = '品牌背书,曝光,粉丝粘性'
  WHERE name = '头部优质音乐博主' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '内容好,传递情绪价值'
  WHERE name = '腰部（其他类）' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '产品特性体现'
  WHERE name = '优质弹唱' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '走量,鼓槌曝光'
  WHERE name = '尾部弹奏弹唱' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '种草投流,长期效果'
  WHERE name = '种草通投流' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '奖励产出,激发创新'
  WHERE name = '基础（奖励）' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '产品测评种草'
  WHERE name = '种草好物测评·抖' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '小红书种草'
  WHERE name = '种草好物测评·红' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '专项激励'
  WHERE name = '奖励费' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '舆论维护'
  WHERE name = '维护 水军' AND COALESCE(default_function_display, '') = '';
UPDATE schedule_categories SET default_function_display = '资源置换合作'
  WHERE name = '置换' AND COALESCE(default_function_display, '') = '';

NOTIFY pgrst, 'reload schema';
