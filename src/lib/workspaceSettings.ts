// 工作台通用设置 —— 暂用 localStorage（后续接 content_workspace_settings）
// 访问时统一走 getSettings / patchSettings，确保 SSR 安全

export interface WorkspaceSettings {
  refresh_interval: number; // 秒，0=关闭
  default_density: "card" | "list";
  default_pool_scope: "personal" | "team";
  desktop_notify: boolean;
}

const KEY = "mi_ws_settings_v1";

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  refresh_interval: 0,
  default_density: "card",
  default_pool_scope: "personal",
  desktop_notify: false,
};

export function getSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<WorkspaceSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function patchSettings(patch: Partial<WorkspaceSettings>): WorkspaceSettings {
  const next = { ...getSettings(), ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("ws-settings-changed", { detail: next }));
  }
  return next;
}

export const REFRESH_OPTIONS = [
  { value: 0, label: "关闭" },
  { value: 300, label: "5 分钟" },
  { value: 900, label: "15 分钟" },
  { value: 1800, label: "30 分钟" },
  { value: 3600, label: "1 小时" },
];
