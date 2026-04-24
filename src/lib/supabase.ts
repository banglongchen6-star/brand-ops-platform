import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";

// 使用 @supabase/ssr 的浏览器客户端：同时把 session 写入 cookie，
// 让服务端 requireAdmin 能通过 cookie 读到登录用户。
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// 角色中文映射
export const roleLabels: Record<string, string> = {
  admin: "系统管理员",
  manager: "管理层",
  ecommerce_op: "电商运营",
  kol_manager: "达人商务",
  content_op: "内容运营",
  channel_manager: "渠道经理",
  service: "客服",
  finance: "财务",
  viewer: "只读访客",
};

export const platformLabels: Record<string, string> = {
  tianmao: "天猫",
  jingdong: "京东",
  douyin: "抖音",
  pinduoduo: "拼多多",
  other: "其他",
};

export const priorityLabels: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export const taskStatusLabels: Record<string, string> = {
  pending: "待开始",
  in_progress: "进行中",
  review: "待审核",
  completed: "已完成",
  overdue: "已逾期",
};
