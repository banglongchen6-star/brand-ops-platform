import { createClient } from '@supabase/supabase-js';

const OLD = createClient(
  'https://gqevvoftqskuuysofncu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZXZ2b2Z0cXNrdXV5c29mbmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMyNzczOSwiZXhwIjoyMDkxOTAzNzM5fQ.orUlrSOY74tE2VszclkdVGFFypLB6z5idcNz1B3b0bc'
);

const NEW = createClient(
  'https://nxnfbshdqpbpmpikrvqi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bmZic2hkcXBicG1waWtydnFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2OTI3NCwiZXhwIjoyMDk1NDQ1Mjc0fQ.-TDzU5QLDw8zPGOeVePUC19k6-fZdYJpxgg8ZHqlfPU'
);

// 取所有旧 profiles
const { data: oldProfiles } = await OLD.from('profiles').select('*');
console.log(`旧库有 ${oldProfiles.length} 个 profile:`);
oldProfiles.forEach(p => console.log(`  - ${p.email} (${p.role})`));

// 取新用户列表
const { data: newUsers } = await NEW.auth.admin.listUsers();

// 把旧 profile 按 email 关联到新用户 ID
const newProfiles = [];
for (const old of oldProfiles) {
  const newUser = newUsers.users.find(u => u.email === old.email);
  if (newUser) {
    newProfiles.push({ ...old, id: newUser.id });
  } else {
    console.log(`⚠️  ${old.email} 在新库没有 auth 用户，跳过`);
  }
}

if (newProfiles.length > 0) {
  // 只保留有把握的列
  const minimal = newProfiles.map(p => ({
    id: p.id,
    name: p.full_name || p.email.split('@')[0],
    email: p.email,
    role: p.role,
    department: p.department,
    is_active: p.is_active,
  }));
  const { data, error } = await NEW.from('profiles').upsert(minimal).select();
  if (error) console.log('❌ 错误:', error);
  else console.log(`\n✅ 已插入 ${data.length} 个 profile`);
}
