import { createClient } from '@supabase/supabase-js';

const OLD = createClient(
  'https://gqevvoftqskuuysofncu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZXZ2b2Z0cXNrdXV5c29mbmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMyNzczOSwiZXhwIjoyMDkxOTAzNzM5fQ.orUlrSOY74tE2VszclkdVGFFypLB6z5idcNz1B3b0bc'
);

const NEW = createClient(
  'https://nxnfbshdqpbpmpikrvqi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bmZic2hkcXBicG1waWtydnFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2OTI3NCwiZXhwIjoyMDk1NDQ1Mjc0fQ.-TDzU5QLDw8zPGOeVePUC19k6-fZdYJpxgg8ZHqlfPU'
);

const DEFAULT_PASSWORD = 'Poputar2026!';  // 临时密码，让团队成员首次登录后改

const { data: oldProfiles } = await OLD.from('profiles').select('*');
const { data: existing } = await NEW.auth.admin.listUsers();
const existingEmails = new Set(existing.users.map(u => u.email));

console.log(`旧库 ${oldProfiles.length} 个用户\n`);

for (const p of oldProfiles) {
  if (existingEmails.has(p.email)) {
    console.log(`⏭️  ${p.email}: 已存在`);
    continue;
  }

  // 创建 auth 用户
  const { data: newUser, error: authErr } = await NEW.auth.admin.createUser({
    email: p.email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,  // 跳过邮箱验证
  });

  if (authErr) {
    console.log(`❌ ${p.email}: ${authErr.message}`);
    continue;
  }

  // 创建 profile
  const { error: profileErr } = await NEW.from('profiles').upsert({
    id: newUser.user.id,
    name: p.full_name || p.email.split('@')[0],
    email: p.email,
    role: p.role,
    department: p.department,
    is_active: p.is_active,
  });

  if (profileErr) {
    console.log(`⚠️  ${p.email}: auth 已建但 profile 失败 - ${profileErr.message}`);
  } else {
    console.log(`✅ ${p.email} (${p.role}) - 密码: ${DEFAULT_PASSWORD}`);
  }
}

// 重新跑一次数据修复，把所有数据关联到新用户 ID
console.log('\n开始关联旧数据到新用户 ID...');
const { data: allNewUsers } = await NEW.auth.admin.listUsers();
const emailToNewId = Object.fromEntries(allNewUsers.users.map(u => [u.email, u.id]));
const emailToOldId = Object.fromEntries(oldProfiles.map(p => [p.email, p.id]));

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
];

for (const email of Object.keys(emailToOldId)) {
  const oldId = emailToOldId[email];
  const newId = emailToNewId[email];
  if (!newId || oldId === newId) continue;

  for (const { table, col } of UPDATES) {
    await NEW.from(table).update({ [col]: newId }).eq(col, oldId);
  }
}
console.log('✅ 关联完成');
