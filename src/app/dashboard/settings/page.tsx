"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Users,
  User,
  Info,
  Plus,
  Loader2,
  X,
  Check,
  Pencil,
  Shield,
  UserCheck,
  UserX,
  ChevronDown,
  Database,
  Bot,
  BookOpen,
  Save,
  Lock,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { supabase, roleLabels } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  department: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

const departmentOptions = [
  "电商部",
  "达人商务部",
  "内容部",
  "渠道部",
  "客服部",
  "财务部",
  "管理层",
];

const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({
  value,
  label,
}));

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  manager: "bg-violet-100 text-violet-700",
  ecommerce_op: "bg-blue-100 text-blue-700",
  kol_manager: "bg-pink-100 text-pink-700",
  content_op: "bg-green-100 text-green-700",
  channel_manager: "bg-orange-100 text-orange-700",
  service: "bg-yellow-100 text-yellow-700",
  finance: "bg-teal-100 text-teal-700",
  viewer: "bg-gray-100 text-gray-600",
};

type TabKey = "team" | "profile" | "system";

interface SystemStats {
  sales: number;
  tasks: number;
  kols: number;
  channels: number;
  tickets: number;
  competitors: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("team");

  // ——— Team tab state ———
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [addForm, setAddForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "viewer",
    department: "管理层",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // ——— Profile tab state ———
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileEditName, setProfileEditName] = useState("");
  const [profileEditDept, setProfileEditDept] = useState("");
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ——— System tab state ———
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [sysLoading, setSysLoading] = useState(false);

  useEffect(() => {
    fetchProfiles();
    fetchCurrentUser();
  }, []);

  // Fetch system stats when switching to system tab
  useEffect(() => {
    if (activeTab === "system" && sysStats === null) {
      fetchSystemStats();
    }
  }, [activeTab]);

  // ——— Team functions ———
  async function fetchProfiles() {
    setLoading(true);
    // 先同步 Auth → profiles（补全可能缺失的用户）
    try {
      await fetch("/api/admin/sync-users", { method: "POST" });
    } catch {
      // 同步失败不影响正常显示
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  }

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setEditForm({
      full_name: profile.full_name || "",
      role: profile.role || "viewer",
      department: profile.department || "",
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name,
        role: editForm.role,
        department: editForm.department,
      })
      .eq("id", id);
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...editForm } : p))
      );
      setEditingId(null);
    }
    setSaving(false);
  }

  async function toggleActive(profile: Profile) {
    const newVal = !profile.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newVal })
      .eq("id", profile.id);
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, is_active: newVal } : p))
      );
    }
  }

  async function handleDelete(profile: Profile) {
    setDeleteLoading(true);
    setDeleteError(null);
    const res = await fetch("/api/admin/delete-user", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id }),
    });
    const result = await res.json();
    if (!res.ok || result.error) {
      setDeleteError(result.error || "删除失败，请重试");
      setDeleteLoading(false);
      return;
    }
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    setDeleteTarget(null);
    setDeleteLoading(false);
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: addForm.email,
        password: addForm.password,
        full_name: addForm.full_name,
        role: addForm.role,
        department: addForm.department,
      }),
    });
    const result = await res.json();
    if (!res.ok || result.error) {
      setAddError(result.error || "创建失败，请重试");
      setAddLoading(false);
      return;
    }
    setAddLoading(false);
    setShowAddModal(false);
    setAddForm({ email: "", password: "", full_name: "", role: "viewer", department: "管理层" });
    fetchProfiles();
  }

  // ——— Profile functions ———
  async function fetchCurrentUser() {
    setProfileLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();
      if (profile) {
        setCurrentUser(profile);
        setProfileEditName(profile.full_name || "");
        setProfileEditDept(profile.department || "");
      }
    }
    setProfileLoading(false);
  }

  async function saveProfile() {
    if (!currentUser) return;
    setProfileSaving(true);
    setProfileMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: profileEditName, department: profileEditDept })
      .eq("id", currentUser.id);
    if (error) {
      setProfileMsg({ type: "err", text: "保存失败: " + error.message });
    } else {
      setCurrentUser((prev) =>
        prev ? { ...prev, full_name: profileEditName, department: profileEditDept } : prev
      );
      setProfileEditing(false);
      setProfileMsg({ type: "ok", text: "资料已更新" });
      setTimeout(() => setProfileMsg(null), 3000);
    }
    setProfileSaving(false);
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwdNew !== pwdConfirm) {
      setPwdMsg({ type: "err", text: "两次密码不一致" });
      return;
    }
    if (pwdNew.length < 6) {
      setPwdMsg({ type: "err", text: "密码至少6位" });
      return;
    }
    setPwdSaving(true);
    setPwdMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pwdNew });
    if (error) {
      setPwdMsg({ type: "err", text: "更新失败: " + error.message });
    } else {
      setPwdMsg({ type: "ok", text: "密码已更新" });
      setPwdNew("");
      setPwdConfirm("");
      setTimeout(() => setPwdMsg(null), 3000);
    }
    setPwdSaving(false);
  }

  // ——— System stats ———
  async function fetchSystemStats() {
    setSysLoading(true);
    const [sales, tasks, kols, channels, tickets, competitors] = await Promise.all([
      supabase.from("sales_records").select("id", { count: "exact", head: true }),
      supabase.from("tasks").select("id", { count: "exact", head: true }),
      supabase.from("kols").select("id", { count: "exact", head: true }),
      supabase.from("channels").select("id", { count: "exact", head: true }),
      supabase.from("service_tickets").select("id", { count: "exact", head: true }),
      supabase.from("competitors").select("id", { count: "exact", head: true }),
    ]);
    setSysStats({
      sales: sales.count ?? 0,
      tasks: tasks.count ?? 0,
      kols: kols.count ?? 0,
      channels: channels.count ?? 0,
      tickets: tickets.count ?? 0,
      competitors: competitors.count ?? 0,
    });
    setSysLoading(false);
  }

  const stats = {
    total: profiles.length,
    active: profiles.filter((p) => p.is_active !== false).length,
    inactive: profiles.filter((p) => p.is_active === false).length,
    admins: profiles.filter((p) => p.role === "admin" || p.role === "manager").length,
  };

  // 只有 admin 角色才能编辑他人信息
  const isAdmin = currentUser?.role === "admin";

  const tabs: { key: TabKey; label: string; Icon: React.ElementType }[] = [
    { key: "team", label: "团队成员", Icon: Users },
    { key: "profile", label: "我的资料", Icon: User },
    { key: "system", label: "系统信息", Icon: Info },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings size={24} className="text-violet-600" />
          系统设置
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">管理团队成员、个人资料与平台信息</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === key
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ====== TAB 1: 团队成员 ====== */}
      {activeTab === "team" && (
        <div className="space-y-6">
          {/* Actions row */}
          <div className="flex items-center justify-between">
            {isAdmin ? (
              <div />
            ) : (
              <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Shield size={14} className="text-amber-600" />
                仅系统管理员可编辑成员信息，您当前为只读模式
              </div>
            )}
            {isAdmin && (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-sm"
                >
                  <Plus size={16} />
                  添加成员
                </button>
                <span className="text-xs text-gray-400">新成员需要通过邮件验证后才能登录</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "总成员", value: stats.total, icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
              { label: "活跃账号", value: stats.active, icon: UserCheck, color: "text-green-600", bg: "bg-green-50" },
              { label: "已停用", value: stats.inactive, icon: UserX, color: "text-red-500", bg: "bg-red-50" },
              { label: "管理人员", value: stats.admins, icon: Shield, color: "text-blue-600", bg: "bg-blue-50" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{s.label}</span>
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", s.bg)}>
                    <s.icon size={15} className={s.color} />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900">{s.value}</div>
              </div>
            ))}
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users size={16} className="text-violet-500" />
                成员列表
              </h2>
              <span className="text-xs text-gray-400">共 {profiles.length} 位成员</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-violet-400" />
              </div>
            ) : error ? (
              <div className="text-center py-16 text-red-400 text-sm">{error}</div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">暂无成员数据</div>
            ) : (
              <div className="divide-y divide-gray-50">
                <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs text-gray-400 font-medium bg-gray-50">
                  <div className="col-span-3">姓名 / 邮箱</div>
                  <div className="col-span-2">角色</div>
                  <div className="col-span-2">部门</div>
                  <div className="col-span-2">状态</div>
                  <div className="col-span-2">加入时间</div>
                  <div className="col-span-1 text-right">操作</div>
                </div>

                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={cn(
                      "grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50 transition",
                      profile.is_active === false && "opacity-60"
                    )}
                  >
                    <div className="col-span-3">
                      {editingId === profile.id ? (
                        <input
                          value={editForm.full_name || ""}
                          onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                          className="w-full border border-violet-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-violet-200"
                          placeholder="姓名"
                        />
                      ) : (
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {profile.full_name || "未设置姓名"}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 truncate">{profile.email}</div>
                        </div>
                      )}
                    </div>

                    <div className="col-span-2">
                      {editingId === profile.id ? (
                        <div className="relative">
                          <select
                            value={editForm.role || "viewer"}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            className="w-full border border-violet-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-violet-200 appearance-none pr-6"
                          >
                            {roleOptions.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      ) : (
                        <span className={cn(
                          "inline-block text-xs font-medium px-2 py-1 rounded-full",
                          roleColors[profile.role || "viewer"] || "bg-gray-100 text-gray-600"
                        )}>
                          {roleLabels[profile.role || ""] || profile.role || "未设置"}
                        </span>
                      )}
                    </div>

                    <div className="col-span-2">
                      {editingId === profile.id ? (
                        <div className="relative">
                          <select
                            value={editForm.department || ""}
                            onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                            className="w-full border border-violet-300 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-violet-200 appearance-none pr-6"
                          >
                            <option value="">选择部门</option>
                            {departmentOptions.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">
                          {profile.department || <span className="text-gray-300">未设置</span>}
                        </span>
                      )}
                    </div>

                    <div className="col-span-2">
                      <button
                        onClick={() => isAdmin && toggleActive(profile)}
                        disabled={!isAdmin}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition",
                          profile.is_active === false
                            ? "bg-gray-100 text-gray-500"
                            : "bg-green-50 text-green-600",
                          isAdmin && (profile.is_active === false
                            ? "hover:bg-red-50 hover:text-red-500 cursor-pointer"
                            : "hover:bg-red-50 hover:text-red-500 cursor-pointer"),
                          !isAdmin && "cursor-not-allowed opacity-70"
                        )}
                      >
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          profile.is_active === false ? "bg-gray-400" : "bg-green-500"
                        )} />
                        {profile.is_active === false ? "已停用" : "活跃"}
                      </button>
                    </div>

                    <div className="col-span-2 text-xs text-gray-400">
                      {profile.created_at
                        ? new Date(profile.created_at).toLocaleDateString("zh-CN")
                        : "—"}
                    </div>

                    <div className="col-span-1 flex justify-end gap-1">
                      {editingId === profile.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(profile.id)}
                            disabled={saving}
                            className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition"
                          >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : isAdmin ? (
                        <>
                          <button
                            onClick={() => startEdit(profile)}
                            className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-violet-100 hover:text-violet-600 transition"
                            title="编辑"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(profile); setDeleteError(null); }}
                            className="w-7 h-7 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition"
                            title="删除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== TAB 2: 我的资料 ====== */}
      {activeTab === "profile" && (
        <div className="space-y-6 max-w-xl">
          {profileLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={28} className="animate-spin text-violet-400" />
            </div>
          ) : !currentUser ? (
            <div className="text-center py-16 text-gray-400 text-sm">无法获取用户信息</div>
          ) : (
            <>
              {/* Profile card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-4 mb-6">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                    {(currentUser.full_name || currentUser.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-gray-900 truncate">
                      {currentUser.full_name || "未设置姓名"}
                    </div>
                    <div className="text-sm text-gray-400 truncate">{currentUser.email}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        roleColors[currentUser.role || "viewer"] || "bg-gray-100 text-gray-600"
                      )}>
                        {roleLabels[currentUser.role || ""] || currentUser.role || "未设置"}
                      </span>
                      {currentUser.department && (
                        <span className="text-xs text-gray-500">{currentUser.department}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info rows */}
                <div className="space-y-1 text-sm text-gray-500 mb-5">
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-16 flex-shrink-0">加入时间</span>
                    <span className="text-gray-700">
                      {currentUser.created_at
                        ? new Date(currentUser.created_at).toLocaleDateString("zh-CN")
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Edit fields */}
                <div className="border-t border-gray-100 pt-5 space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-gray-700">编辑资料</h3>
                    {!profileEditing && (
                      <button
                        onClick={() => setProfileEditing(true)}
                        className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium"
                      >
                        <Pencil size={12} />
                        编辑
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">姓名</label>
                    <input
                      value={profileEditName}
                      onChange={(e) => setProfileEditName(e.target.value)}
                      disabled={!profileEditing}
                      className={cn(
                        "w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition",
                        profileEditing
                          ? "border-violet-300 focus:ring-2 focus:ring-violet-100"
                          : "border-gray-100 bg-gray-50 text-gray-500 cursor-default"
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">部门</label>
                    {profileEditing ? (
                      <div className="relative">
                        <select
                          value={profileEditDept}
                          onChange={(e) => setProfileEditDept(e.target.value)}
                          className="w-full border border-violet-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-100 appearance-none"
                        >
                          <option value="">选择部门</option>
                          {departmentOptions.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    ) : (
                      <input
                        value={profileEditDept}
                        disabled
                        className="w-full border border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-500 cursor-default"
                      />
                    )}
                  </div>

                  {profileMsg && (
                    <div className={cn(
                      "text-xs px-3 py-2 rounded-lg",
                      profileMsg.type === "ok" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                    )}>
                      {profileMsg.text}
                    </div>
                  )}

                  {profileEditing && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setProfileEditing(false);
                          setProfileEditName(currentUser.full_name || "");
                          setProfileEditDept(currentUser.department || "");
                        }}
                        className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
                      >
                        取消
                      </button>
                      <button
                        onClick={saveProfile}
                        disabled={profileSaving}
                        className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        保存
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Change password card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-5">
                  <Lock size={15} className="text-violet-500" />
                  修改密码
                </h3>
                <form onSubmit={updatePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">新密码</label>
                    <input
                      type="password"
                      value={pwdNew}
                      onChange={(e) => setPwdNew(e.target.value)}
                      placeholder="至少6位"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">确认密码</label>
                    <input
                      type="password"
                      value={pwdConfirm}
                      onChange={(e) => setPwdConfirm(e.target.value)}
                      placeholder="再次输入新密码"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    />
                  </div>

                  {pwdMsg && (
                    <div className={cn(
                      "text-xs px-3 py-2 rounded-lg",
                      pwdMsg.type === "ok" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                    )}>
                      {pwdMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={pwdSaving || !pwdNew || !pwdConfirm}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {pwdSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    更新密码
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* ====== TAB 3: 系统信息 ====== */}
      {activeTab === "system" && (
        <div className="space-y-5 max-w-2xl">
          {/* 平台信息 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <Info size={15} className="text-violet-500" />
              平台信息
            </h3>
            <div className="space-y-3">
              {[
                { label: "系统名称", value: "音乐密码品牌经营协同平台" },
                { label: "版本", value: "v1.0.0" },
                { label: "技术栈", value: "Next.js + Supabase + Claude AI" },
                { label: "部署平台", value: "Vercel" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-700 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 数据统计 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <Database size={15} className="text-violet-500" />
              数据统计
            </h3>
            {sysLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={22} className="animate-spin text-violet-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "销售记录数", value: sysStats?.sales ?? 0, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "任务数", value: sysStats?.tasks ?? 0, color: "text-violet-600", bg: "bg-violet-50" },
                  { label: "达人数", value: sysStats?.kols ?? 0, color: "text-pink-600", bg: "bg-pink-50" },
                  { label: "渠道数", value: sysStats?.channels ?? 0, color: "text-orange-600", bg: "bg-orange-50" },
                  { label: "客服工单数", value: sysStats?.tickets ?? 0, color: "text-yellow-600", bg: "bg-yellow-50" },
                  { label: "竞品数", value: sysStats?.competitors ?? 0, color: "text-teal-600", bg: "bg-teal-50" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600">{label}</span>
                    <span className={cn("text-sm font-bold px-2.5 py-0.5 rounded-lg", bg, color)}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI 配置 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <Bot size={15} className="text-violet-500" />
              AI 配置
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 w-20 flex-shrink-0">Claude 模型</span>
                <span className="text-sm text-gray-700 font-medium font-mono">claude-opus-4-6</span>
              </div>
              <div className="flex items-start gap-4 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">功能</span>
                <span className="text-sm text-gray-700">深度分析 · 流式输出 · 多轮对话</span>
              </div>
              <div className="flex items-center gap-4 py-2">
                <span className="text-xs text-gray-400 w-20 flex-shrink-0">API 状态</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  已配置
                </span>
              </div>
            </div>
          </div>

          {/* 使用说明 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
              <BookOpen size={15} className="text-violet-500" />
              使用说明
            </h3>
            <ul className="space-y-2.5">
              {[
                "建议团队每天录入当日各平台销售数据",
                "每周使用智能复盘中心生成周报",
                "如遇问题联系管理员重置密码",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900 text-center mb-1">确认删除成员？</h3>
              <p className="text-sm text-gray-500 text-center mb-1">
                即将删除账号：
              </p>
              <p className="text-sm font-semibold text-gray-800 text-center mb-1">
                {deleteTarget.full_name || "未命名"}
              </p>
              <p className="text-xs text-gray-400 text-center mb-5">
                {deleteTarget.email}
              </p>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
                <p className="text-xs text-red-600 text-center">
                  ⚠️ 此操作<strong>不可撤销</strong>，删除后该账号将无法登录
                </p>
              </div>
              {deleteError && (
                <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-4 text-center">
                  {deleteError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                  disabled={deleteLoading}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  disabled={deleteLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Plus size={16} className="text-violet-600" />
                添加团队成员
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setAddError(null); }}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="p-5 space-y-4">
              {addError && (
                <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{addError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">姓名</label>
                <input
                  required
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="输入真实姓名"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">邮箱</label>
                <input
                  required
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="example@company.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">初始密码</label>
                <input
                  required
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="至少6位字符"
                  minLength={6}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">角色</label>
                  <div className="relative">
                    <select
                      value={addForm.role}
                      onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      {roleOptions.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">部门</label>
                  <div className="relative">
                    <select
                      value={addForm.department}
                      onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 appearance-none"
                    >
                      {departmentOptions.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setAddError(null); }}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {addLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  创建账号
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
