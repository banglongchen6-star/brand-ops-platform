"use client";

// 排期导入向导 —— 4 步 modal
// 1. 上传 → 2. 字段映射 → 3. 预览（含错误）→ 4. 执行（前端分批轮调 execute）

import { useEffect, useRef, useState } from "react";
import {
  X, Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle,
  ChevronRight, ArrowLeft, Download,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

interface PreviewResp {
  headers: string[];
  mapping: Record<string, string>;
  missingRequired: string[];
  rows: Array<{
    index: number;
    raw: Record<string, unknown>;
    parsed: ParsedRow | null;
    errors: string[];
  }>;
  stats: { total: number; ok: number; withError: number };
}

interface ParsedRow {
  schedule_date: string;
  category: string;
  category_direction: string;
  kol_name: string;
  tier: string;
  amount: number;
  platform: string;
  status: string;
  publish_url: string;
  notes: string;
}

const FIELD_OPTIONS: { key: string; label: string; required?: boolean }[] = [
  { key: "schedule_date",      label: "日期",     required: true },
  { key: "category",           label: "类目",     required: true },
  { key: "category_direction", label: "方向" },
  { key: "kol_name",           label: "达人名",   required: true },
  { key: "tier",               label: "层级" },
  { key: "amount",             label: "费用",     required: true },
  { key: "platform",           label: "平台" },
  { key: "status",             label: "状态" },
  { key: "publish_url",        label: "发布链接" },
  { key: "notes",              label: "备注" },
];

export function ImportWizard({
  onClose, onCompleted,
}: { onClose: () => void; onCompleted: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const [preview, setPreview] = useState<PreviewResp | null>(null);
  // 用户可以手工修改的 mapping（来自 preview.mapping，可改）
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const [conflictStrategy, setConflictStrategy] = useState<"skip" | "overwrite" | "fillEmpty">("skip");

  // step 4 进度
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [logId, setLogId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ success: 0, skipped: 0, failed: 0, processed: 0, total: 0 });
  const [allErrors, setAllErrors] = useState<{ line: number; reason: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 上传 + 预览
  async function handleUpload() {
    if (!file) return;
    setErr(""); setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/kol-schedules/import/preview", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "预览失败"); setUploading(false); return; }
      setPreview(j as PreviewResp);
      setMapping(j.mapping ?? {});
      setStep(2);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "网络错误");
    } finally {
      setUploading(false);
    }
  }

  // 应用 mapping 后重新计算 row.parsed —— 简化处理：mapping 改动只触发"是否有必填字段"的判定，
  // 实际值仍以 preview 服务端解析的为准。如果用户改了 mapping，需要用户点"重新解析"
  // （为了简化，本版要求 mapping 一旦确认就直接用预览结果）。
  const requiredKeys = FIELD_OPTIONS.filter((f) => f.required).map((f) => f.key);
  const mappedKeys = new Set(Object.values(mapping));
  const stillMissingRequired = requiredKeys.filter((k) => !mappedKeys.has(k));

  // 重新跑一次预览（mapping 改了）
  const [remapping, setRemapping] = useState(false);
  async function reparseWithMapping() {
    if (!file) return;
    setErr(""); setRemapping(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/kol-schedules/import/preview", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "解析失败"); return; }
      // 用用户改过的 mapping 覆盖
      setPreview({ ...(j as PreviewResp), mapping });
    } finally {
      setRemapping(false);
    }
  }

  function gotoPreview() {
    setStep(3);
  }

  // 执行
  async function execute() {
    if (!preview) return;
    const okRows = preview.rows.filter((r) => r.parsed !== null && r.errors.length === 0);
    if (okRows.length === 0) { setErr("没有可导入的有效数据"); return; }

    setRunning(true); setErr(""); setStep(4);
    setProgress({ success: 0, skipped: 0, failed: 0, processed: 0, total: okRows.length });
    setAllErrors([]);

    let curLogId: string | null = null;
    const batchSize = 100;
    try {
      for (let i = 0; i < okRows.length; i += batchSize) {
        const slice = okRows.slice(i, i + batchSize).map((row) => row.parsed!);
        const isFinal = i + batchSize >= okRows.length;
        const resp: Response = await fetch("/api/kol-schedules/import/execute", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batch: slice,
            conflictStrategy,
            logId: curLogId,
            filename: file?.name || "import.xlsx",
            totalRows: okRows.length,
            isFinal,
          }),
        });
        const j = await resp.json();
        if (!resp.ok) throw new Error(j.error || "导入失败");
        curLogId = j.logId;
        setLogId(curLogId);
        setProgress((p) => ({
          success: p.success + j.batchResult.success,
          skipped: p.skipped + j.batchResult.skipped,
          failed: p.failed + j.batchResult.failed,
          processed: p.processed + slice.length,
          total: okRows.length,
        }));
        if (j.batchResult.errors?.length) {
          setAllErrors((prev) => [...prev, ...j.batchResult.errors]);
        }
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "导入异常");
    } finally {
      setRunning(false);
    }
  }

  function downloadTemplate() {
    window.location.href = "/api/kol-schedules/import/template";
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Excel 导入排期</h3>
            <Stepper step={step} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Step 1：上传 */}
          {step === 1 && (
            <div className="text-center py-6">
              <input
                ref={fileInputRef} type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) setFile(f);
                }}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-violet-400 hover:bg-violet-50/40 transition"
              >
                <Upload size={28} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-700 font-medium">
                  {file ? file.name : "点击或拖拽 Excel 文件到此"}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  支持 .xlsx / .xls / .csv，5 MB 内 / 最多 5000 行
                </p>
              </div>

              <button
                onClick={downloadTemplate}
                className="mt-4 text-xs text-violet-700 hover:underline inline-flex items-center gap-1"
              >
                <Download size={12} /> 下载导入模板
              </button>

              {err && <p className="text-xs text-rose-600 mt-3">{err}</p>}

              <div className="mt-6 flex justify-end gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">取消</button>
                <button
                  disabled={!file || uploading}
                  onClick={handleUpload}
                  className="inline-flex items-center gap-1 px-4 py-1.5 rounded-md bg-violet-600 text-white text-xs disabled:opacity-50 hover:bg-violet-500"
                >
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <ChevronRight size={13} />}
                  下一步
                </button>
              </div>
            </div>
          )}

          {/* Step 2：字段映射 */}
          {step === 2 && preview && (
            <div className="space-y-4">
              <div className="text-xs text-gray-500">
                共 {preview.headers.length} 列，请把每一列对应到系统字段。带 * 的为必填。
              </div>
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                {preview.headers.map((h, idx) => {
                  const cur = mapping[h] || "";
                  return (
                    <div key={idx} className="flex items-center px-3 py-2 gap-3 text-sm">
                      <div className="flex-1 truncate">
                        <span className="text-gray-900 font-medium">{h || `(空表头 ${idx + 1})`}</span>
                      </div>
                      <ChevronRight size={14} className="text-gray-300" />
                      <select
                        value={cur}
                        onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                        className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm bg-white"
                      >
                        <option value="">— 不导入 —</option>
                        {FIELD_OPTIONS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}{f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {stillMissingRequired.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <AlertTriangle size={14} />
                  必填字段未映射：
                  {stillMissingRequired.map((k) => FIELD_OPTIONS.find((f) => f.key === k)?.label).join("、")}
                </div>
              )}

              {err && <p className="text-xs text-rose-600">{err}</p>}

              <div className="flex justify-between">
                <button onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
                  <ArrowLeft size={12} /> 重新上传
                </button>
                <div className="flex gap-2">
                  <button onClick={reparseWithMapping} disabled={remapping}
                    className="px-3 py-1.5 text-xs text-violet-700 border border-violet-200 rounded-md hover:bg-violet-50 disabled:opacity-50">
                    {remapping && <Loader2 size={12} className="inline-block animate-spin mr-1" />}
                    应用映射并重新解析
                  </button>
                  <button
                    disabled={stillMissingRequired.length > 0}
                    onClick={gotoPreview}
                    className="inline-flex items-center gap-1 px-4 py-1.5 rounded-md bg-violet-600 text-white text-xs disabled:opacity-50 hover:bg-violet-500"
                  >
                    下一步 <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3：预览 */}
          {step === 3 && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="总行数" value={preview.stats.total} />
                <Stat label="有效行" value={preview.stats.ok} accent="text-green-700" />
                <Stat label="错误行" value={preview.stats.withError} accent={preview.stats.withError ? "text-rose-700" : ""} />
              </div>

              <div className="text-xs text-gray-500">
                重复策略（按"日期 + 达人 + 类目"判定重复）：
              </div>
              <div className="flex gap-2">
                {[
                  { v: "skip", label: "跳过" },
                  { v: "overwrite", label: "覆盖" },
                  { v: "fillEmpty", label: "仅填充空字段" },
                ].map((opt) => (
                  <button key={opt.v}
                    onClick={() => setConflictStrategy(opt.v as typeof conflictStrategy)}
                    className={`px-3 py-1.5 text-xs rounded border ${
                      conflictStrategy === opt.v
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="border border-gray-200 rounded-md overflow-x-auto max-h-[40vh]">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left w-10">#</th>
                      <th className="px-2 py-1 text-left">日期</th>
                      <th className="px-2 py-1 text-left">达人</th>
                      <th className="px-2 py-1 text-left">类目</th>
                      <th className="px-2 py-1 text-right">费用</th>
                      <th className="px-2 py-1 text-left">状态</th>
                      <th className="px-2 py-1 text-left">问题</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 200).map((r) => (
                      <tr key={r.index} className={`border-t border-gray-100 ${r.errors.length ? "bg-rose-50/50" : ""}`}>
                        <td className="px-2 py-1 text-gray-400 tabular-nums">{r.index}</td>
                        <td className="px-2 py-1 tabular-nums">{r.parsed?.schedule_date ?? "—"}</td>
                        <td className="px-2 py-1">{r.parsed?.kol_name ?? "—"}</td>
                        <td className="px-2 py-1">{r.parsed?.category ?? "—"}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.parsed?.amount?.toLocaleString() ?? "—"}</td>
                        <td className="px-2 py-1">{r.parsed?.status ?? "—"}</td>
                        <td className="px-2 py-1 text-rose-700 max-w-[280px] truncate" title={r.errors.join("；")}>
                          {r.errors.join("；") || "—"}
                        </td>
                      </tr>
                    ))}
                    {preview.rows.length > 200 && (
                      <tr><td colSpan={7} className="px-2 py-2 text-center text-gray-400">仅展示前 200 行，剩余 {preview.rows.length - 200} 行将一并导入</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {err && <p className="text-xs text-rose-600">{err}</p>}

              <div className="flex justify-between">
                <button onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
                  <ArrowLeft size={12} /> 返回映射
                </button>
                <button
                  disabled={preview.stats.ok === 0}
                  onClick={execute}
                  className="inline-flex items-center gap-1 px-4 py-1.5 rounded-md bg-violet-600 text-white text-xs disabled:opacity-50 hover:bg-violet-500">
                  开始导入（{preview.stats.ok} 行）
                </button>
              </div>
            </div>
          )}

          {/* Step 4：执行 */}
          {step === 4 && (
            <div className="space-y-4 py-2">
              <div className="text-center">
                {!done ? (
                  <Loader2 size={32} className="mx-auto text-violet-500 animate-spin" />
                ) : (
                  <CheckCircle2 size={32} className="mx-auto text-green-500" />
                )}
                <p className="mt-2 text-sm text-gray-700">
                  {done ? "导入完成" : `正在导入… ${progress.processed} / ${progress.total}`}
                </p>
              </div>

              <div className="w-full h-2 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${progress.total ? (progress.processed / progress.total) * 100 : 0}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="成功" value={progress.success} accent="text-green-700" />
                <Stat label="跳过" value={progress.skipped} />
                <Stat label="失败" value={progress.failed} accent={progress.failed ? "text-rose-700" : ""} />
              </div>

              {allErrors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-rose-700">查看 {allErrors.length} 条失败原因</summary>
                  <div className="mt-2 max-h-40 overflow-auto bg-rose-50/40 rounded p-2 space-y-1">
                    {allErrors.slice(0, 50).map((e, i) => (
                      <div key={i}>第 {e.line} 行：{e.reason}</div>
                    ))}
                    {allErrors.length > 50 && <div>… 仅展示前 50 条</div>}
                  </div>
                </details>
              )}

              {err && <p className="text-xs text-rose-600 text-center">{err}</p>}

              <div className="flex justify-end gap-2 pt-2">
                {done && (
                  <button onClick={onCompleted}
                    className="px-4 py-1.5 rounded-md bg-violet-600 text-white text-xs hover:bg-violet-500">
                    完成
                  </button>
                )}
                {!running && !done && (
                  <button onClick={onClose}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">关闭</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["上传", "映射", "预览", "执行"];
  return (
    <div className="flex items-center gap-1 text-[10px]">
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const passed = n < step;
        return (
          <div key={l} className="flex items-center gap-1">
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] tabular-nums ${
              active ? "bg-violet-600" : passed ? "bg-violet-300" : "bg-gray-300"
            }`}>{n}</span>
            <span className={active ? "text-violet-700 font-medium" : "text-gray-400"}>{l}</span>
            {n < 4 && <span className="text-gray-300">›</span>}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-gray-50 rounded-md py-2">
      <div className="text-[10px] text-gray-500">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${accent || "text-gray-900"}`}>{value}</div>
    </div>
  );
}
