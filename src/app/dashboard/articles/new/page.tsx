"use client";

// 新建文章 —— 创建草稿后跳转到 /dashboard/articles/[id]
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NewArticleRedirect() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const r = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = await r.json();
      if (!r.ok || !j.id) {
        alert("创建草稿失败：" + (j.error || "未知错误"));
        router.replace("/dashboard/articles");
        return;
      }
      router.replace(`/dashboard/articles/${j.id}`);
    })();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
      <Loader2 className="animate-spin mr-2" size={18} />
      正在创建草稿...
    </div>
  );
}
