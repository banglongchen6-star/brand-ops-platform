// 排期导入 · 执行（client 驱动的分批写入）
//
// 客户端发来一批 ≤ 100 条 parsed 行 + conflictStrategy。
// 服务端按"日期+达人名+类目"做去重判断后写库。
//
// POST {
//   batch: [{ schedule_date, category, kol_name, ..., (kol_id?) }, ...],
//   conflictStrategy: 'skip' | 'overwrite' | 'fillEmpty',
//   logId?: string,                 // 可选：把进度累加到日志记录
//   filename?: string,              // 第一批传入用于初始化日志
//   isFinal?: boolean,              // 最后一批，把日志的 total 写入
//   totalRows?: number,             // 第一批传入用作日志 total
// }
//
// 返回 { logId, batchResult: { success, skipped, failed, errors[] }, log: {...} }
//
// 客户端轮询 /api/kol-schedules/import/[logId] 也能拿到累积进度。

import { requireUser } from "@/lib/requireUser";
import { getAdminClient } from "@/lib/supabaseAdmin";

const MAX_BATCH = 100;

interface BatchItem {
  schedule_date: string;
  category: string;
  category_direction?: string;
  kol_name: string;
  kol_id?: string | null;
  tier?: string;
  amount: number;
  platform?: string;
  status?: string;
  publish_url?: string;
  publish_date?: string | null;
  notes?: string;
}

export async function POST(req: Request) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const batch: BatchItem[] = Array.isArray(body.batch) ? body.batch : [];
  const conflictStrategy = String(body.conflictStrategy || "skip") as "skip" | "overwrite" | "fillEmpty";
  let logId: string | null = body.logId || null;
  const filename: string = String(body.filename || "import.xlsx");
  const totalRows: number = Number(body.totalRows) || 0;
  const isFinal: boolean = !!body.isFinal;

  if (batch.length > MAX_BATCH) {
    return Response.json({ error: `单批最多 ${MAX_BATCH} 行` }, { status: 400 });
  }
  if (!["skip", "overwrite", "fillEmpty"].includes(conflictStrategy)) {
    return Response.json({ error: "conflictStrategy 非法" }, { status: 400 });
  }

  const admin = getAdminClient();

  // 1. 第一批：建立日志记录
  if (!logId) {
    const { data: log, error } = await admin
      .from("schedule_import_logs")
      .insert({
        filename,
        total_rows: totalRows,
        success_count: 0,
        skipped_count: 0,
        failed_count: 0,
        errors: [],
        imported_by: guard.userId,
      })
      .select("id")
      .single();
    if (error) return Response.json({ error: "创建导入日志失败：" + error.message }, { status: 500 });
    logId = log.id as string;
  }

  // 2. 处理本批
  let success = 0, skipped = 0, failed = 0;
  const batchErrors: { line: number; reason: string }[] = [];

  for (let i = 0; i < batch.length; i++) {
    const it = batch[i];
    try {
      // 去重 key：(schedule_date, kol_name, category)
      const { data: dup } = await admin
        .from("kol_schedules")
        .select("id, kol_id, category_direction, tier, platform, status, publish_url, publish_date, notes, amount")
        .eq("schedule_date", it.schedule_date)
        .eq("kol_name", it.kol_name)
        .eq("category", it.category)
        .maybeSingle();

      const baseFields = {
        category_direction: it.category_direction ?? "",
        tier: it.tier ?? "",
        amount: it.amount,
        platform: it.platform ?? "",
        status: it.status || "planned",
        publish_url: it.publish_url ?? "",
        publish_date: it.publish_date || null,
        notes: it.notes ?? "",
        kol_id: it.kol_id ?? null,
        updated_by: guard.userId,
      };

      if (dup) {
        if (conflictStrategy === "skip") { skipped++; continue; }
        if (conflictStrategy === "overwrite") {
          const { error } = await admin.from("kol_schedules").update(baseFields).eq("id", dup.id);
          if (error) throw error;
          success++;
          continue;
        }
        // fillEmpty: 仅填充原本为空的字段
        const merged: Record<string, unknown> = { updated_by: guard.userId };
        const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (typeof v === "number" && v === 0 && false);
        if (isEmpty(dup.category_direction)) merged.category_direction = baseFields.category_direction;
        if (isEmpty(dup.tier)) merged.tier = baseFields.tier;
        if (Number(dup.amount) === 0) merged.amount = baseFields.amount;
        if (isEmpty(dup.platform)) merged.platform = baseFields.platform;
        if (isEmpty(dup.publish_url)) merged.publish_url = baseFields.publish_url;
        if (isEmpty(dup.publish_date)) merged.publish_date = baseFields.publish_date;
        if (isEmpty(dup.notes)) merged.notes = baseFields.notes;
        if (isEmpty(dup.kol_id)) merged.kol_id = baseFields.kol_id;
        if (Object.keys(merged).length === 1) { skipped++; continue; }
        const { error } = await admin.from("kol_schedules").update(merged).eq("id", dup.id);
        if (error) throw error;
        success++;
      } else {
        const { error } = await admin.from("kol_schedules").insert({
          schedule_date: it.schedule_date,
          category: it.category,
          kol_name: it.kol_name,
          ...baseFields,
          created_by: guard.userId,
        });
        if (error) throw error;
        success++;
      }
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      batchErrors.push({ line: i + 1, reason: msg });
    }
  }

  // 3. 把本批结果累加到日志
  // 用 RPC/SQL 自增最干净，但这里改成读再写（service_role 可以）
  const { data: cur } = await admin
    .from("schedule_import_logs")
    .select("success_count, skipped_count, failed_count, errors")
    .eq("id", logId).maybeSingle();
  const merged = {
    success_count: (cur?.success_count ?? 0) + success,
    skipped_count: (cur?.skipped_count ?? 0) + skipped,
    failed_count: (cur?.failed_count ?? 0) + failed,
    errors: [...((cur?.errors as { line: number; reason: string }[]) ?? []), ...batchErrors],
    ...(isFinal && totalRows ? { total_rows: totalRows } : {}),
  };
  await admin.from("schedule_import_logs").update(merged).eq("id", logId);

  return Response.json({
    logId,
    batchResult: { success, skipped, failed, errors: batchErrors },
    log: { ...merged, id: logId },
  });
}
