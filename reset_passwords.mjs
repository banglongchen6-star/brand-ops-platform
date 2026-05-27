import { createClient } from '@supabase/supabase-js';

const NEW = createClient(
  'https://nxnfbshdqpbpmpikrvqi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bmZic2hkcXBicG1waWtydnFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2OTI3NCwiZXhwIjoyMDk1NDQ1Mjc0fQ.-TDzU5QLDw8zPGOeVePUC19k6-fZdYJpxgg8ZHqlfPU'
);

const NEW_PASSWORD = '123456';

const { data: { users } } = await NEW.auth.admin.listUsers();

for (const u of users) {
  const { error } = await NEW.auth.admin.updateUserById(u.id, { password: NEW_PASSWORD });
  if (error) console.log(`❌ ${u.email}: ${error.message}`);
  else console.log(`✅ ${u.email}: 密码已改为 ${NEW_PASSWORD}`);
}
