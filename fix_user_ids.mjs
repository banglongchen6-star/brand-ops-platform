import { createClient } from '@supabase/supabase-js';

const OLD = createClient(
  'https://gqevvoftqskuuysofncu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZXZ2b2Z0cXNrdXV5c29mbmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMyNzczOSwiZXhwIjoyMDkxOTAzNzM5fQ.orUlrSOY74tE2VszclkdVGFFypLB6z5idcNz1B3b0bc'
);

const NEW = createClient(
  'https://nxnfbshdqpbpmpikrvqi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bmZic2hkcXBicG1waWtydnFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2OTI3NCwiZXhwIjoyMDk1NDQ1Mjc0fQ.-TDzU5QLDw8zPGOeVePUC19k6-fZdYJpxgg8ZHqlfPU'
);

const TARGET_EMAIL = 'chenbanglong@poputar.com';

// 1. 找旧用户 ID
const { data: oldUsers } = await OLD.auth.admin.listUsers();
const oldUser = oldUsers.users.find(u => u.email === TARGET_EMAIL);
console.log('旧用户 ID:', oldUser?.id);

// 2. 找新用户 ID
const { data: newUsers } = await NEW.auth.admin.listUsers();
const newUser = newUsers.users.find(u => u.email === TARGET_EMAIL);
console.log('新用户 ID:', newUser?.id);

if (!oldUser || !newUser) {
  console.log('❌ 找不到用户');
  process.exit(1);
}

const OLD_ID = oldUser.id;
const NEW_ID = newUser.id;

// 3. 在新库里把所有 owner_id/created_by/user_id 改成新 ID
const UPDATES = [
  { table: 'personal_notes', col: 'owner_id' },
  { table: 'note_categories', col: 'owner_id' },
  { table: 'tasks', col: 'creator_id' },
  { table: 'tasks', col: 'assignee_id' },
  { table: 'tasks', col: 'owner_id' },
  { table: 'tasks', col: 'assigned_to' },
  { table: 'tasks', col: 'reviewer_id' },
  { table: 'kol_schedules', col: 'created_by' },
  { table: 'kol_schedules', col: 'updated_by' },
  { table: 'schedule_budgets', col: 'created_by' },
  { table: 'schedule_budgets', col: 'updated_by' },
  { table: 'notification_configs', col: 'user_id' },
  { table: 'ai_model_configs', col: 'created_by' },
  { table: 'competitor_reports', col: 'created_by' },
];

for (const { table, col } of UPDATES) {
  const { data, error } = await NEW.from(table).update({ [col]: NEW_ID }).eq(col, OLD_ID).select();
  if (error) console.log(`⚠️  ${table}.${col}: ${error.message}`);
  else console.log(`✅ ${table}.${col}: 更新 ${data?.length ?? 0} 条`);
}

// 4. 也把 profiles 里的旧用户记录复制一份到新 ID
const { data: oldProfile } = await OLD.from('profiles').select('*').eq('id', OLD_ID).single();
if (oldProfile) {
  const newProfile = { ...oldProfile, id: NEW_ID };
  await NEW.from('profiles').upsert(newProfile);
  console.log(`✅ profiles: 创建新用户档案（含 role/department）`);
}

console.log('\n完成！刷新页面看效果。');
