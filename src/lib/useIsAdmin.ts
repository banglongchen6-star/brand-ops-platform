// 客户端 hook：判断当前登录用户是否为 admin
// 仅用于 UI 入口显示/隐藏，真正权限校验走服务端 requireAdmin

"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setIsAdmin(data?.role === "admin");
    }
    check();
    return () => { cancelled = true; };
  }, []);

  return isAdmin;
}
