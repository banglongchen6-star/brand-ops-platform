// 排期 Excel 导出
// GET /api/kol-schedules/export?year=2026&month=5
//
// 可选 categories=a,b  tiers=头部,腰部 与列表 API 同口径

import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { COLUMNS, statusLabel } from "@/lib/scheduleExcel";
import * as XLSX from "xlsx";

function parseInt2(v: string | null, def: number): number {
  const n = Number(v);
  return Number.isInteger(n) ? n : def;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const today = new Date();
  const year = parseInt2(searchParams.get("year"), today.getFullYear());
  const month = parseInt2(searchParams.get("month"), today.getMonth() + 1);

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonth = new Date(Date.UTC(year, month, 1));

  const categories = (searchParams.get("categories") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const tiers = (searchParams.get("tiers") || "").split(",").map((s) => s.trim()).filter(Boolean);

  const admin = getAdminClient();
  let qb = admin
    .from("kol_schedules")
    .select("schedule_date, category, category_direction, kol_name, tier, amount, platform, status, publish_url, notes")
    .gte("schedule_date", ymd(monthStart))
    .lt("schedule_date", ymd(nextMonth))
    .order("schedule_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (categories.length) qb = qb.in("category", categories);
  if (tiers.length) qb = qb.in("tier", tiers);

  const { data, error } = await qb;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 组装行（中文表头 + 状态映射成中文）
  const headers = COLUMNS.map((c) => c.header);
  const rows: (string | number)[][] = [headers];
  for (const r of data ?? []) {
    rows.push([
      r.schedule_date as string,
      (r.category as string) ?? "",
      (r.category_direction as string) ?? "",
      (r.kol_name as string) ?? "",
      (r.tier as string) ?? "",
      Number(r.amount) || 0,
      (r.platform as string) ?? "",
      statusLabel((r.status as string) ?? ""),
      (r.publish_url as string) ?? "",
      (r.notes as string) ?? "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // 设定列宽（视觉舒适）
  ws["!cols"] = [
    { wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 18 },
    { wch: 6 },  { wch: 10 }, { wch: 8 }, { wch: 8 },
    { wch: 32 }, { wch: 24 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${year}年${month}月`);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const filename = `达人排期_${year}${String(month).padStart(2, "0")}.xlsx`;

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
