# 达人营销板块 · 交接文档

> 用途：让另一个 AI 在零上下文情况下重新实现"达人营销"板块的所有功能。
> 当前生产实现：`brand-ops-platform`（Next.js 16 + Supabase）。本文档与技术栈无关——重点是**业务规则**、**数据模型**、**API 契约**、**关键交互**。

---

## 1. 业务概览

「达人营销」是品宣组（约 3 人）每天用的模块，处理两件事：

### 1.1 达人列表 `/dashboard/kol`
管理达人资源池：建联状态、合作记录、价格、粉丝数等。普通 CRUD，没有特别难点，按常规电商运营后台的"客户管理"思路即可。

### 1.2 排期表 `/dashboard/kol/schedule` ⭐ 核心
品宣组原本用 3 张 Excel 维护（月度规划 / 月历排期 / 预算追踪），本模块把这三件事合并成一个系统页面：
- **录入一次**（在月历卡片）
- **月度规划表**的"已花/数量"列**自动汇总**
- 团队不再手算 Excel

---

## 2. 顶层信息架构

```
/dashboard/kol           (整个达人营销模块)
│
├── 顶部标题「达人营销」 + 两个 tab
├── Tab 1: 排期表          ← 默认进来落在这里（高频）
├── Tab 2: 达人列表
│
└── /schedule/settings    (字典管理，从排期表的右上角按钮进)
```

**侧栏入口**：「达人营销」一个入口，点击 landing 到 `/dashboard/kol/schedule`（排期表是高频功能）；但当用户在 `/dashboard/kol`（达人列表）时，侧栏入口仍高亮。技巧：sidebar entry 有 `href` 字段控制高亮匹配前缀，`landing` 字段控制实际跳转目标。

---

## 3. 数据模型

### 3.1 SQL（PostgreSQL；幂等可重跑）

```sql
-- ============ 1. 达人类型字典（核心） ============
-- 原名 schedule_directions，每行是一个"达人类型"（如：弹唱、弹奏、鼓棒、生活、教学、亲子、种草、口播、测评、乐队、剧情、Vlog）
-- 月度规划表的行底来自这张表（is_active=true）
CREATE TABLE IF NOT EXISTS schedule_directions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schedule_directions (name, sort_order) VALUES
  ('弹唱', 1), ('弹奏', 2), ('鼓棒', 3), ('生活', 4),
  ('教学', 5), ('亲子', 6), ('种草', 7), ('口播', 8),
  ('测评', 9), ('乐队', 10), ('剧情', 11), ('Vlog', 12)
ON CONFLICT (name) DO NOTHING;

-- ============ 2. 排期主表 ============
CREATE TABLE IF NOT EXISTS kol_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_date DATE NOT NULL,
  category TEXT NOT NULL DEFAULT '',     -- 已废弃字段，保留为空字符串
  category_direction TEXT DEFAULT '',    -- ⭐ 实际意义：「达人类型」名（FK 软引用 schedule_directions.name）
  tier TEXT DEFAULT ''
    CHECK (tier IN ('头部','中部','腰部','尾部','素人','')),
  kol_name TEXT NOT NULL,
  kol_id UUID REFERENCES kols(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,    -- 元
  platform TEXT DEFAULT '',                   -- 抖音 / 小红书 / 全平台 等
  status TEXT DEFAULT 'planned'
    CHECK (status IN ('planned','contacted','confirmed','published','settled','cancelled')),
  publish_url TEXT DEFAULT '',
  publish_date DATE,
  notes TEXT DEFAULT '',
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_date     ON kol_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_tier     ON kol_schedules(tier);
CREATE INDEX IF NOT EXISTS idx_schedule_kol      ON kol_schedules(kol_id);

-- ============ 3. 月度预算（规划表的"计划"层） ============
-- 注：保留 category 列名，但实际存的是"达人类型"名（FK 软引用 schedule_directions.name）
-- 历史上 category 列原本存"类目"，重构后语义改为"达人类型"
CREATE TABLE IF NOT EXISTS schedule_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  category TEXT NOT NULL,                   -- ⭐ 存"达人类型"名
  budget_amount NUMERIC(10,2) DEFAULT 0,    -- 元
  target_count INTEGER,                     -- 目标条数，NULL = 不设
  platform TEXT DEFAULT '',
  requirements TEXT DEFAULT '',
  function_display TEXT DEFAULT '',         -- 「功能展示」列内容
  notes TEXT DEFAULT '',
  created_by UUID, updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month, category)
);

-- ============ 4. 导入日志 ============
CREATE TABLE IF NOT EXISTS schedule_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  imported_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ 5. 达人库（外部依赖） ============
-- 你的"达人列表" CRUD 用的表，本模块只读引用 kol_id 字段
-- 实际字段视新系统而定，本模块只依赖：id, name, platform, followers, category
```

### 3.2 ⚠️ 字段命名陷阱

| 字段 | 命名上看像什么 | 实际意义 |
|---|---|---|
| `kol_schedules.category` | 类目 | **已废弃**，永远存空字符串 |
| `kol_schedules.category_direction` | 内容方向 | **「达人类型」**（弹唱/弹奏/鼓棒…）—— 这才是规划表 GROUP BY 的 key |
| `schedule_budgets.category` | 类目 | **「达人类型」**名 —— 跟 schedule_directions.name 对齐 |

**为什么这么乱？**：历史上"类目"和"方向"是两个独立维度，后来类目废弃，但字段名没改保持向后兼容。重新实现时**完全可以把这些字段重命名得更清晰**，比如把 `category_direction` 改名 `kol_type` 或 `direction`。

---

## 4. 业务规则（容易踩坑的关键点）

### 4.1 数据流闭环

```
新建排期：
  用户在编辑器选「达人类型」(下拉=schedule_directions.is_active=true)
  → 落到 kol_schedules.category_direction

月度规划表实时统计：
  按 kol_schedules.category_direction GROUP BY
  统计 SUM(amount) 和 COUNT(*)，cancelled 状态不计
  → 显示在对应达人类型行的"实际/已花"列
```

### 4.2 规划表行的来源

月度规划表每行 = **schedule_directions 字典里 is_active=true 的达人类型**。所以：
- 字典里没有的达人类型，不在规划表显示
- 但如果 kol_schedules 里有 category_direction 字段值不在字典里，需要在规划表底部作为"孤儿行"展示（淡黄底色 + 标注"未在字典"），并给一个"加入字典"按钮（点击后调 quick-create 把它加进字典并启用）

### 4.3 删除达人类型时连带清理

垃圾桶按钮点击时，**有数据**则需要二次确认 + 同时删 3 件事：
1. `kol_schedules` 里所有 `category_direction = 该名` 的行（**含其他月份**，不限当前月）
2. `schedule_budgets` 里所有 `category = 该名` 的行（所有月份的预算配置）
3. `schedule_directions.is_active = false`（软删除字典）

弱提示：删除是不可恢复的硬删除（kol_schedules 和 schedule_budgets），所以 confirm 弹窗要写明"包括其他月份"。

### 4.4 "+ 添加达人类型"的智能逻辑

输入框 + 下拉列出字典里**全部**达人类型（含已停用），每行右侧标状态：
- **已在表里**（绿色）：已激活，已经在规划表里 → 点击后提示"已经在规划表里了"，不做事
- **已停用**（灰色）：已停用 → 点击后 PATCH `is_active=true` 重新启用，立刻出现在规划表里
- 用户键入字典里没有的名称 → 下拉底部出现「+ 新建「xxx」」 → POST 创建新条目

### 4.5 双月日历

排期主页同时显示**当月 + 下月**两个日历（垂直堆叠）。当用户切换月份时，两个一起换（5 月 + 6 月 → 6 月 + 7 月）。月度规划表只显示**当月**的数据。

跨年正确处理（12 月 → 12+1月 = 次年 1 月）。

### 4.6 月历单元格交互

- **整格可点**（非 hover-only 的小 + 号）：点空白处弹"新增排期"抽屉，日期已预填
- **点已有排期卡片**：弹"编辑排期"抽屉
- 排期卡片的 onClick 用 `e.stopPropagation()` 避免触发父格的"新增"
- 今天的格子用**浅紫底色 + 「今」徽章**（不要用紫色 ring 边框——会让用户误以为"选中"）

### 4.7 月历卡片显示信息（3 行）

```
万万也没想到        ← 第 1 行：达人名（truncate）
¥500       尾部    ← 第 2 行：金额（左）+ 层级（右上小字）
弹唱 · 抖音        ← 第 3 行：达人类型 · 平台
```

如果某格超过 2 条排期，显示 `+ N 条`（点击进入第 3 条编辑）。

### 4.8 状态颜色（用于卡片金额字色）

```
planned   → text-gray-500    (计划中)
contacted → text-amber-700   (已联系)
confirmed → text-blue-700    (已确认)
published → text-violet-700  (已发布)
settled   → text-green-700   (已结算)
cancelled → text-gray-400 line-through (已取消)
```

cancelled 状态在月度规划表的"实际"统计里 **不计入**。

### 4.9 月度规划表列结构（最终版）

| 列 | 宽 | 来源 | 编辑方式 |
|---|---|---|---|
| 达人类型 | 20% | schedule_directions.name | 只读（在 settings 改） |
| 平台 | 12% | schedule_budgets.platform | 内联编辑 |
| 预算（万） | 11% | schedule_budgets.budget_amount | 内联编辑，UI 单位万元，存储元 |
| 数量 | 11% | schedule_budgets.target_count | 内联编辑（**目标条数**，不是实际） |
| 功能展示 | 20% | schedule_budgets.function_display | 内联编辑（如"品牌背书,曝光,粉丝粘性"） |
| 要求 | 22% | schedule_budgets.requirements | 内联编辑 |
| 删除 | 4% | (操作列) | 垃圾桶图标 |

底部合计行：总预算（万）+ 总目标数 + 缺口/超支提示

"数量"列是**目标条数**（计划做几条），不是实际数量；实际数量看月历。**这是规划表，不是统计表**。

### 4.10 角色权限

- **任何已登录用户** 可看排期表、可增删改自己创建的排期、可导入导出
- **manager 或 admin** 才能：编辑预算（schedule_budgets）、增删达人类型字典、复制上月预算

后端 helper 推荐分 3 个守卫：
- `requireUser` —— 已登录 + 账号启用
- `requireManager` —— admin 或 manager
- `requireAdmin` —— 只 admin

---

## 5. API 端点清单

### 5.1 排期 CRUD

```
GET    /api/kol-schedules?year=2026&month=5&tiers=头部,腰部
       → 返回月历结构（5 周 × 7 天）+ 月度小计
       ?tiers= 可选筛选

POST   /api/kol-schedules
       body: { schedule_date, kol_name, kol_id?, category_direction, tier, amount, platform, status, publish_url, publish_date, notes }
       → 创建一条排期

GET    /api/kol-schedules/[id]    → 详情
PATCH  /api/kol-schedules/[id]    → 部分更新
DELETE /api/kol-schedules/[id]    → 删除
```

### 5.2 月度规划表

```
GET    /api/schedule-budgets?year=2026&month=5
       → 服务端把 schedule_directions（行底）+ schedule_budgets（预算配置）
         + kol_schedules（实际数据，按 category_direction GROUP BY）三层 JOIN
         返回 { rows: [...], total: { budget, target, spent, count, gap } }

PUT    /api/schedule-budgets    (manager+)
       body: { year, month, category, budgetAmount?, targetCount?, platform?, requirements?, functionDisplay?, notes? }
       行为：部分更新；只校验本次提交字段，缺失字段从已有记录读出保留，upsert (year, month, category)

POST   /api/schedule-budgets/copy-from-last-month    (manager+)
       body: { year, month }   ← 目标月份
       → 把上月所有 schedule_budgets 行复制到目标月（已存在的跳过，只补缺失）
```

### 5.3 达人类型字典

```
GET    /api/schedule-directions   → 返回全部（含 is_active=false）
POST   /api/schedule-directions   (manager+) body: { name, sort_order? }
       行为：upsert 语义 —— name 已存在且 is_active=false 则 PATCH is_active=true 复用；
            否则新建
PATCH  /api/schedule-directions/[id]   (manager+)
       body 可含: { name?, sort_order?, is_active?, cascadeDeleteSchedules? }
       关键：cascadeDeleteSchedules=true 时，先按 name 在
            kol_schedules 删所有 category_direction 匹配的行
            +  schedule_budgets 删所有 category 匹配的行（含其他月份）
            再 PATCH is_active=false
            返回 { ok, deletedSchedules, deletedBudgets }
```

### 5.4 达人库

```
GET    /api/kols/search?q=xxx        → 模糊搜索 name，最多返回 8 条
POST   /api/kols/quick-create        body: { name, platform? }
       行为：upsert —— 同名同平台直接返回已有 row；否则建新 row + status=pending
```

### 5.5 Excel 导入向导（4 步）

```
GET   /api/kol-schedules/import/template    → 下载模板 .xlsx
POST  /api/kol-schedules/import/preview     multipart { file }
      → 解析 + 字段映射建议 + 单元格级校验
      返回 { headers, mapping, rows: [{parsed, errors}], stats: {total, ok, withError} }
POST  /api/kol-schedules/import/execute
      body: { batch: ParsedRow[], conflictStrategy, logId?, filename?, totalRows?, isFinal? }
      行为：客户端驱动的分批写入（100/批），去重键 (schedule_date, kol_name, category_direction)
            conflictStrategy: skip | overwrite | fillEmpty
      返回 { logId, batchResult: { success, skipped, failed, errors } }
GET   /api/kol-schedules/import/[logId]     → 查询累计进度

GET   /api/kol-schedules/export?year=&month=&tiers=  → 导出当月 .xlsx
```

### 5.6 GET `/api/kol-schedules` 月度返回结构示例

```typescript
{
  year: 2026,
  month: 5,
  weeks: [
    {
      weekNum: 18,
      days: [
        {
          date: "2026-04-27",
          weekday: 1,
          items: [],
          isCurrentMonth: false   // 跨月灰显
        },
        ...
        {
          date: "2026-05-01",
          weekday: 5,
          items: [
            {
              id: "...",
              kolName: "万万也没想到",
              kolId: null,
              amount: 500,
              categoryDirection: "弹唱",
              tier: "尾部",
              platform: "抖音",
              status: "settled",
              publishUrl: "",
              publishDate: null,
              notes: ""
            }
          ],
          isCurrentMonth: true
        },
        ...
      ],
      weekTotal: 12903
    }
  ],
  monthTotal: 52854,
  totalCount: 27
}
```

### 5.7 GET `/api/schedule-budgets` 返回结构

```typescript
{
  year: 2026, month: 5,
  rows: [
    {
      categoryId: "uuid",         // schedule_directions.id（null = 孤儿行）
      category: "弹唱",            // 达人类型名
      shortName: "弹唱",
      budgetAmount: 120000,       // 元
      targetCount: 12,            // 目标条数（null = 不设）
      platform: "抖音",
      functionDisplay: "品牌背书,曝光",
      requirements: "1/弹唱",
      actualSpent: 15150,         // 由 kol_schedules 按 category_direction GROUP BY 算出
      actualCount: 4,
      gap: 104850,
      hasBudgetRecord: true       // false = 该月份还没设过预算
    },
    ...
  ],
  total: { budget: 265000, target: 62, spent: 52854, count: 27, gap: 212146 }
}
```

---

## 6. 页面/组件结构

### 6.1 路由

```
/dashboard/kol                       默认 → 跳转到 /dashboard/kol/schedule
/dashboard/kol/schedule              ⭐ 排期表主页（默认）
/dashboard/kol/schedule/settings     字典管理（达人类型增删改）
/dashboard/kol（达人列表 tab）        达人 CRUD 页面
```

### 6.2 关键组件

| 组件 | 行数 | 职责 |
|---|---|---|
| `<KolSelector>` | ~200 | 达人选择器（搜索 + 一键创建） |
| `<BudgetTable>` | ~570 | 月度规划表（内联编辑 4 字段 + 删 + 加） |
| `<ImportWizard>` | ~480 | Excel 导入 4 步向导 |
| `<FilterDialog>` | ~80 | 筛选弹窗（按层级） |
| `<ScheduleEditor>` | ~400 | 排期编辑抽屉（右侧滑入） |
| `<CalendarGrid>` | ~80 | 月历 5×7 网格 |
| `<AddDirectionRow>` | ~120 | 「+ 添加达人类型」下拉浮层 |

### 6.3 排期编辑器字段

抽屉表单（从右侧滑入）：

```
日期         (date picker)
达人         (KolSelector 组件：搜+建新)
达人类型     (select from schedule_directions where is_active=true)
层级         (select: 头部/中部/腰部/尾部/素人)
平台         (input text)
费用 (¥)    (number, ≥0)
状态         (select 6 个枚举)
[发布链接 + 发布日期]  ← 仅当状态 ≥ 已发布 时显示
备注         (textarea)

[ 删除 ]                              [取消] [保存]
              ☐ 保存后继续添加（仅新建时）
```

---

## 7. 关键代码片段（复刻这些细节就能省 80% 时间）

### 7.1 Excel 解析器（`scheduleExcel.ts`）

```typescript
// 列定义
export const COLUMNS = [
  { key: "schedule_date",     header: "日期",     required: true,  example: "2026-05-01" },
  { key: "category",          header: "类目",     required: false, example: "" },
  { key: "category_direction",header: "方向",     required: false, example: "弹唱" },
  { key: "kol_name",          header: "达人名",   required: true,  example: "万万也没想到" },
  { key: "tier",              header: "层级",     required: false, example: "尾部" },
  { key: "amount",            header: "费用",     required: true,  example: 500 },
  { key: "platform",          header: "平台",     required: false, example: "抖音" },
  { key: "status",            header: "状态",     required: false, example: "已结算" },
  { key: "publish_url",       header: "发布链接", required: false, example: "https://..." },
  { key: "notes",             header: "备注",     required: false, example: "" },
] as const;

// 状态：枚举 ↔ 中文双向映射
export const STATUS_TO_LABEL = {
  planned: "计划中", contacted: "已联系", confirmed: "已确认",
  published: "已发布", settled: "已结算", cancelled: "已取消",
};

export function parseStatus(raw): { ok: true; value } | { ok: false; error } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: "planned" };
  const s = String(raw).trim();
  // 同时接受 中文 label 和 英文 enum
  const v = LABEL_TO_STATUS[s];
  if (!v) return { ok: false, error: `状态「${s}」不识别` };
  return { ok: true, value: v };
}

// 层级：5 枚举 + 空
const TIER_VALUES = new Set(["头部", "中部", "腰部", "尾部", "素人"]);
export function parseTier(raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: "" };
  const s = String(raw).trim();
  if (!TIER_VALUES.has(s)) return { ok: false, error: `层级「${s}」非法` };
  return { ok: true, value: s };
}

// 日期：支持 2026-05-01 / 2026/5/1 / 5月1日 / Excel 序列号
export function parseDate(raw, contextYear?) {
  if (raw === undefined || raw === null || raw === "") return { ok: false, error: "日期不能为空" };
  // Excel 数字序列号（基准 1899-12-30）
  if (typeof raw === "number") {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + raw * 86400000);
    return { ok: true, value: d.toISOString().slice(0, 10) };
  }
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日$/))) {
    const y = contextYear ?? new Date().getFullYear();
    return formatYMD(y, +m[1], +m[2]);
  }
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    return formatYMD(+m[1], +m[2], +m[3]);
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return { ok: true, value: d.toISOString().slice(0, 10) };
  return { ok: false, error: `日期「${s}」格式不识别` };
}

// 费用：支持 "￥500" / "500元" / "5,000" / "5万"
export function parseAmount(raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: false, error: "费用不能为空" };
  if (typeof raw === "number") {
    if (raw < 0) return { ok: false, error: "费用不能为负" };
    return { ok: true, value: raw };
  }
  const s = String(raw).replace(/[¥￥,，\s元]/g, "").trim();
  const wanMatch = s.match(/^([\d.]+)\s*万$/);
  if (wanMatch) {
    const n = Number(wanMatch[1]) * 10000;
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: `费用「${s}」无效` };
    return { ok: true, value: n };
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: `费用「${raw}」无效` };
  return { ok: true, value: n };
}
```

### 7.2 月度规划 GET API 三层 JOIN 逻辑（伪代码）

```typescript
async function GET_schedule_budgets(year, month) {
  // 1. 取活跃的达人类型字典作为行底
  const activeDirs = await db.from("schedule_directions")
    .select("*").eq("is_active", true).orderBy("sort_order");

  // 2. 取当月预算
  const budgets = await db.from("schedule_budgets")
    .select("*").eq("year", year).eq("month", month);
  const budgetByName = Object.fromEntries(budgets.map(b => [b.category, b]));

  // 3. 取当月所有排期，按 category_direction GROUP BY
  const monthStart = `${year}-${String(month).padStart(2,'0')}-01`;
  const nextMonth = nextMonthOf(year, month); // 跨年处理
  const schedules = await db.from("kol_schedules")
    .select("category_direction, amount, status")
    .gte("schedule_date", monthStart).lt("schedule_date", nextMonthStart);

  const actualByDir = {};
  for (const s of schedules) {
    if (s.status === "cancelled") continue;  // 取消不计
    if (!actualByDir[s.category_direction]) {
      actualByDir[s.category_direction] = { spent: 0, count: 0 };
    }
    actualByDir[s.category_direction].spent += Number(s.amount);
    actualByDir[s.category_direction].count++;
  }

  // 4. 拼接：以字典为底，覆盖预算字段，加上实际统计
  const rows = activeDirs.map(d => {
    const b = budgetByName[d.name];
    const actual = actualByDir[d.name] ?? { spent: 0, count: 0 };
    const budgetAmount = b?.budget_amount ?? 0;
    return {
      categoryId: d.id,
      category: d.name,
      shortName: d.name,
      budgetAmount,
      targetCount: b?.target_count ?? null,
      platform: b?.platform ?? "",
      functionDisplay: b?.function_display ?? "",
      requirements: b?.requirements ?? "",
      actualSpent: actual.spent,
      actualCount: actual.count,
      gap: budgetAmount - actual.spent,  // 可负
      hasBudgetRecord: !!b,
    };
  });

  // 5. 兜底：字典里没有但 actualByDir 有数据 → 加孤儿行（categoryId: null）
  for (const [name, actual] of Object.entries(actualByDir)) {
    if (!activeDirs.find(d => d.name === name)) {
      rows.push({
        categoryId: null,
        category: name, shortName: name,
        budgetAmount: 0, targetCount: null, platform: "",
        functionDisplay: "", requirements: "",
        actualSpent: actual.spent, actualCount: actual.count,
        gap: -actual.spent, hasBudgetRecord: false,
      });
    }
  }

  return { year, month, rows, total: aggregateTotal(rows) };
}
```

### 7.3 内联编辑单元格行为

每个可编辑单元格（预算/目标/平台/要求/功能展示）：
- 默认渲染为"按钮"样态，hover 显示浅紫底色
- 点击 → 变为输入框，自动 focus + select
- 失焦或按 Enter → 调用 onSave(newValue) 保存
- Esc → 取消编辑，恢复原值
- 保存中 → 显示小 loader spinner

**乐观更新**：父组件先改本地状态再调 PUT，失败时回滚 + alert。这样网络好时手感如丝滑 Excel。

预算单元格特殊：显示用"万元"（如 `12`），存储用"元"（120000），编辑时输入万元，保存时 `Math.round(wan * 10000)`。

### 7.4 KolSelector 关键交互

```typescript
function KolSelector({ name, kolId, onChange, defaultPlatform }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  // 防抖搜索 250ms
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!name.trim()) return setItems([]);
      const r = await fetch(`/api/kols/search?q=${encodeURIComponent(name.trim())}`);
      const j = await r.json();
      setItems(j.items || []);
    }, 250);
    return () => clearTimeout(t);
  }, [name]);

  // 输入即清空 kolId（视为输入新名字）
  function onInputChange(v) {
    onChange(v, null);
    setOpen(true);
  }

  // blur 延迟 150ms 关下拉（让点击选项的事件先触发）
  function onBlur() {
    setTimeout(() => setOpen(false), 150);
  }

  function pickExisting(item) {
    onChange(item.name, item.id);  // 绑定 kol_id
    setOpen(false);
  }

  async function createNew() {
    const r = await fetch("/api/kols/quick-create", {
      method: "POST", body: JSON.stringify({ name, platform: defaultPlatform })
    });
    const { item } = await r.json();
    onChange(item.name, item.id);
    setOpen(false);
  }

  // ...render input + dropdown with items + "创建新达人 xxx" 兜底
}
```

### 7.5 Excel 导入向导（4 步）

```
Step 1：上传文件（拖拽/点击）+ 下载模板按钮
Step 2：字段映射 —— 用户确认每个 Excel 列对应哪个内部字段
  - 服务端做 fuzzy match 给出建议（"时间"→schedule_date, "博主"→kol_name 等）
  - 必填字段（日期/达人名/费用）若未映射则禁用"下一步"
Step 3：预览 —— 表格展示前 200 行 + 错误行红底
  - 选择冲突策略：跳过 / 覆盖 / 仅填空字段
Step 4：执行 —— 客户端驱动的分批写入
  - 每批 100 条调 /import/execute
  - 进度条 + 实时累计成功/跳过/失败计数
  - 失败行下方折叠显示原因
```

冲突去重键：`(schedule_date, kol_name, category_direction)`

---

## 8. 验收清单（业务完成的判定）

### 8.1 数据
- [ ] 5 张表（schedule_directions/kol_schedules/schedule_budgets/schedule_import_logs/kols）建好
- [ ] 12 个达人类型种子默认插入
- [ ] 月度查询 <300ms（200 条测试数据）

### 8.2 月历
- [ ] 双月并排显示（当月 + 下月）
- [ ] 跨月日期灰显
- [ ] 今天的格子有「今」徽章 + 浅紫底
- [ ] 整格可点 → 新增；点排期卡片 → 编辑
- [ ] 一格 >2 条折叠"+N 条"
- [ ] 月份切换 / 层级筛选生效

### 8.3 排期录入
- [ ] 达人选择器：搜索已有 + 一键创建新达人
- [ ] 达人类型下拉来源 schedule_directions（active）
- [ ] 状态切到「已发布」「已结算」才显示发布链接 + 发布日期
- [ ] 必填字段离开时红框提示
- [ ] 「保存后继续添加」勾上 → 不关 drawer，清空表单留下

### 8.4 月度规划表
- [ ] 行底 = active 的达人类型，按 sort_order 排序
- [ ] 已花/数量与月历联动（删/改/导入后自动刷新）
- [ ] 缺口正确计算，超支用 amber 色
- [ ] 4 个字段内联可编辑（manager+）
- [ ] 编辑预算 UI 单位是万元，存储元
- [ ] 「+ 添加达人类型」下拉显示字典全部 + 状态标
- [ ] 删除按钮：有数据时连带删 schedules + budgets
- [ ] 孤儿行（categoryId=null）淡黄底 + 显示「未在字典」标签 + 加入按钮

### 8.5 字典管理
- [ ] manager+ 进 settings 页能增删改方向
- [ ] 已激活的方向不能改名（避免破坏关联数据），先停用再删
- [ ] 软删除 is_active=false，不真删

### 8.6 Excel 导入导出
- [ ] 模板下载（表头 + 1 行示例 + 第 2 个 sheet「填写说明」）
- [ ] 5MB / 5000 行上限
- [ ] 日期/费用/状态/层级 都按 §7.1 规则解析
- [ ] 三种冲突策略可选
- [ ] 5000 行分批写入有进度
- [ ] 失败行展示原因
- [ ] 导出当月 .xlsx 含所有字段

---

## 9. 总计代码量参考

| 部分 | 约行数 |
|---|---|
| SQL migration | 120 |
| API（11 个端点） | 1200 |
| 月历主页 + 编辑器 | 820 |
| 月度规划表 | 570 |
| Excel 导入向导 | 480 |
| 达人选择器 | 200 |
| Excel 解析器 | 120 |
| 筛选弹窗 | 80 |
| 字典管理页 | 200 |
| **合计** | **~3800 行 TypeScript + 120 行 SQL** |

3 人 × 3 周大致可以做完，单人 AI 全自动 + 用户验收循环约 3-5 天。

---

## 10. 给重建的 AI 的提示

1. **不要被字段名误导**：`category_direction` 实际上是「达人类型」；`schedule_budgets.category` 实际上也是「达人类型」名。如果重新设计 schema，把它们改成 `kol_type` 或 `direction_name` 会更清楚。
2. **三层 JOIN 的逻辑（§7.2）是这个模块的灵魂**——字典提供"应该有哪些行"，预算表提供"计划层"，排期表提供"实际执行层"。
3. **删除连锁** 是最容易遗漏的细节（§4.3）——只软删除字典不删数据 → 用户下次启用会看到一堆历史数据。
4. **乐观更新 + 失败回滚**（§7.3）让内联编辑体感像 Excel——值得花时间做好。
5. **Excel 解析器**（§7.1）实战中容错最重要——用户的 Excel 千奇百怪，多种日期/金额格式都得兼容。
6. **去重键** 是 `(schedule_date, kol_name, category_direction)`——重复导入不会创建重复记录。

如果新系统是另一种技术栈，本文档的 SQL、API 契约、业务规则都是技术无关的，照搬即可。UI 实现可参考组件结构，但具体框架按目标平台调整。

---

**生成时间**：2026-05
**来源系统**：brand-ops-platform（Next.js 16 + Supabase + Tailwind v4）
**对应 git 仓库**：`github.com/banglongchen6-star/brand-ops-platform`
