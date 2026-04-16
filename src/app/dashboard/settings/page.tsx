"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Users,
  Plus,
  Loader2,
  X,
  Check,
  Pencil,
  Shield,
  UserCheck,
  UserX,
  ChevronDown,
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

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add member form
  const [addForm, setAddForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "viewer",
    department: "管理层",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    const { data, error } = await supabase.auth.signUp({
      email: addForm.email,
      password: addForm.password,
      options: {
        data: {
          full_name: addForm.full_name,
          role: addForm.role,
          department: addForm.department,
        },
      },
    });
    if (error) {
      setAddError(error.message);
      setAddLoading(false);
      return;
    }
    // Upsert profile manually if needed
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: addForm.email,
        full_name: addForm.full_name,
        role: addForm.role,
        department: addForm.department,
        is_active: true,
      });
    }
    setAddLoading(false);
    setShowAddModal(false);
    setAddForm({ email: "", password: "", full_name: "", role: "viewer", department: "管理层" });
    fetchProfiles();
  }

  const stats = {
    total: profiles.length,
    active: profiles.filter((p) => p.is_active !== false).length,
    inactive: profiles.filter((p) => p.is_active === false).length,
    admins: profiles.filter((p) => p.role === "admin" || p.role === "manager").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings size={24} className="text-violet-600" />
            系统设置
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">管理团队成员账号、角色权限与部门归属</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-sm"
        >
          <Plus size={16} />
          添加成员
        </button>
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
            {/* Table header */}
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
                {/* Name/Email */}
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

                {/* Role */}
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

                {/* Department */}
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

                {/* Status */}
                <div className="col-span-2">
                  <button
                    onClick={() => toggleActive(profile)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition",
                      profile.is_active === false
                        ? "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500"
                        : "bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500"
                    )}
                  >
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      profile.is_active === false ? "bg-gray-400" : "bg-green-500"
                    )} />
                    {profile.is_active === false ? "已停用" : "活跃"}
                  </button>
                </div>

                {/* Join Date */}
                <div className="col-span-2 text-xs text-gray-400">
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString("zh-CN")
                    : "—"}
                </div>

                {/* Actions */}
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
                  ) : (
                    <button
                      onClick={() => startEdit(profile)}
                      className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-violet-100 hover:text-violet-600 transition"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
