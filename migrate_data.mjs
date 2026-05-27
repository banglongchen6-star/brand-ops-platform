import { createClient } from '@supabase/supabase-js';

const OLD = createClient(
  'https://gqevvoftqskuuysofncu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZXZ2b2Z0cXNrdXV5c29mbmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMyNzczOSwiZXhwIjoyMDkxOTAzNzM5fQ.orUlrSOY74tE2VszclkdVGFFypLB6z5idcNz1B3b0bc'
);

const NEW = createClient(
  'https://nxnfbshdqpbpmpikrvqi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bmZic2hkcXBicG1waWtydnFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2OTI3NCwiZXhwIjoyMDk1NDQ1Mjc0fQ.-TDzU5QLDw8zPGOeVePUC19k6-fZdYJpxgg8ZHqlfPU'
);

const TABLES = [
  // 'profiles',  // 用户表单独处理
  'ai_model_configs',
  'content_platforms',
  // 'content_hit_factors',  // schema cache 问题，数据不重要
  'content_keyword_library',
  'content_candidate_pool',
  'content_tropes',
  'content_workspace_settings',
  // 'content_trends',  // 热榜数据，重新同步即可
  'hot_source_configs',
  'note_categories',
  'personal_notes',
  'competitors',
  'competitor_skus',
  'competitor_sku_snapshots',
  'competitor_events',
  'competitor_reports',
  'kols',
  'kol_schedules',
  'schedule_directions',
  'schedule_budgets',
  'schedule_import_logs',
  'offline_stores',
  'notification_configs',
  'tasks',
];

// 这些表有种子数据，先清空再插入
const CLEAR_FIRST = ['content_platforms', 'content_hit_factors', 'content_keyword_library', 'schedule_directions'];

async function migrateTable(table) {
  const { data, error } = await OLD.from(table).select('*');
  if (error) { console.log(`⚠️  ${table}: 读取失败 - ${error.message}`); return; }
  if (!data || data.length === 0) { console.log(`⏭️  ${table}: 空表，跳过`); return; }

  if (CLEAR_FIRST.includes(table)) {
    await NEW.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  // tasks 状态值转换（pending_review → review）
  const STATUS_MAP = { pending_review: 'review' };
  const VALID_STATUS = new Set(['pending','in_progress','review','completed','overdue','cancelled']);
  const rows = table === 'tasks'
    ? data.map(r => ({ ...r, status: STATUS_MAP[r.status] ?? (VALID_STATUS.has(r.status) ? r.status : 'pending') }))
    : data;

  const { error: insertError } = await NEW.from(table).upsert(rows, { ignoreDuplicates: true });
  if (insertError) {
    console.log(`❌ ${table}: 写入失败 - ${insertError.message}`);
  } else {
    console.log(`✅ ${table}: ${data.length} 条`);
  }
}

console.log('开始迁移数据...\n');
for (const table of TABLES) {
  await migrateTable(table);
}
console.log('\n迁移完成！');
