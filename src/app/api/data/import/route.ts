import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "请上传文件" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Platform name mapping (handles variations)
    const PLATFORM_MAP: Record<string, string> = {
      天猫: "天猫",
      "天猫旗舰店": "天猫",
      京东: "京东",
      "京东自营": "京东",
      抖音: "抖音",
      "抖音小店": "抖音",
      小红书: "小红书",
      视频号: "视频号",
      "微信视频号": "视频号",
      渠道分销: "渠道分销",
      分销: "渠道分销",
      其他: "其他",
    };

    const records: Array<{
      date: string;
      platform: string;
      gmv: number;
      order_count: number;
      ad_spend: number;
      refund_amount: number;
    }> = [];

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      if (!rows || rows.length < 2) continue;

      // Auto-detect headers in first non-empty row
      let headerRow = -1;
      let headers: string[] = [];

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i] as string[];
        const rowStr = row.map((c) => String(c || "").trim()).join("");
        if (
          rowStr.includes("日期") ||
          rowStr.includes("平台") ||
          rowStr.includes("GMV") ||
          rowStr.includes("销售额") ||
          rowStr.includes("销售金额")
        ) {
          headerRow = i;
          headers = row.map((c) => String(c || "").trim());
          break;
        }
      }

      if (headerRow === -1) {
        // Try first row as header
        headerRow = 0;
        headers = (rows[0] as string[]).map((c) => String(c || "").trim());
      }

      // Map column indices
      const colMap = {
        date: -1,
        platform: -1,
        gmv: -1,
        orders: -1,
        adSpend: -1,
        refund: -1,
      };

      headers.forEach((h, i) => {
        const lower = h.toLowerCase();
        if (colMap.date === -1 && (lower.includes("日期") || lower.includes("date"))) colMap.date = i;
        if (colMap.platform === -1 && (lower.includes("平台") || lower.includes("platform"))) colMap.platform = i;
        if (colMap.gmv === -1 && (lower.includes("gmv") || lower.includes("销售额") || lower.includes("销售金额") || lower.includes("成交金额"))) colMap.gmv = i;
        if (colMap.orders === -1 && (lower.includes("订单") || lower.includes("order") || lower.includes("件数") || lower.includes("数量"))) colMap.orders = i;
        if (colMap.adSpend === -1 && (lower.includes("推广费") || lower.includes("广告费") || lower.includes("ad_spend") || lower.includes("推广"))) colMap.adSpend = i;
        if (colMap.refund === -1 && (lower.includes("退款") || lower.includes("refund"))) colMap.refund = i;
      });

      // Parse data rows
      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i] as (string | number)[];
        if (!row || row.length === 0) continue;

        // Get date
        let dateStr = "";
        if (colMap.date >= 0 && row[colMap.date] !== undefined && row[colMap.date] !== null && row[colMap.date] !== "") {
          const rawDate = row[colMap.date];
          if (typeof rawDate === "number") {
            // Excel date serial: convert to JS Date
            const excelEpoch = new Date(1899, 11, 30);
            const d = new Date(excelEpoch.getTime() + rawDate * 86400000);
            dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          } else {
            dateStr = String(rawDate).trim();
            // Handle formats like "2026/1/15" or "2026.1.15"
            dateStr = dateStr.replace(/\./g, "-").replace(/\//g, "-");
            // Ensure proper padding
            const parts = dateStr.split("-");
            if (parts.length === 3) {
              dateStr = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
            }
          }
        }

        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          totalSkipped++;
          continue;
        }

        // Get platform
        let platform = "其他";
        if (colMap.platform >= 0 && row[colMap.platform]) {
          const raw = String(row[colMap.platform]).trim();
          platform = PLATFORM_MAP[raw] || raw || "其他";
        } else {
          // Sheet name might be the platform
          const mapped = PLATFORM_MAP[sheetName.trim()];
          if (mapped) platform = mapped;
        }

        // Get numeric values
        const gmv = colMap.gmv >= 0 ? parseFloat(String(row[colMap.gmv] || 0)) || 0 : 0;
        const orders = colMap.orders >= 0 ? parseInt(String(row[colMap.orders] || 0)) || 0 : 0;
        const adSpend = colMap.adSpend >= 0 ? parseFloat(String(row[colMap.adSpend] || 0)) || 0 : 0;
        const refund = colMap.refund >= 0 ? parseFloat(String(row[colMap.refund] || 0)) || 0 : 0;

        if (gmv === 0 && orders === 0) {
          totalSkipped++;
          continue;
        }

        records.push({
          date: dateStr,
          platform,
          gmv,
          order_count: orders,
          ad_spend: adSpend,
          refund_amount: refund,
        });
        totalInserted++;
      }
    }

    if (records.length === 0) {
      return Response.json(
        { error: "未能识别到有效数据，请确认文件格式（需要日期、平台、销售额等列）" },
        { status: 400 }
      );
    }

    // Batch upsert in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("sales_data")
        .upsert(chunk, { onConflict: "date,platform" });
      if (error) {
        console.error("Upsert error:", error);
      }
    }

    return Response.json({
      success: true,
      inserted: totalInserted,
      skipped: totalSkipped,
      message: `成功导入 ${totalInserted} 条记录`,
    });
  } catch (err) {
    console.error("Import error:", err);
    return Response.json({ error: "文件解析失败，请检查格式" }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
