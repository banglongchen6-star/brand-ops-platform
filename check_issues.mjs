import { createClient } from '@supabase/supabase-js';

const OLD = createClient(
  'https://gqevvoftqskuuysofncu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZXZ2b2Z0cXNrdXV5c29mbmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMyNzczOSwiZXhwIjoyMDkxOTAzNzM5fQ.orUlrSOY74tE2VszclkdVGFFypLB6z5idcNz1B3b0bc'
);

// 检查 tasks 里有哪些 status 值
const { data: taskStatuses } = await OLD.from('tasks').select('status');
const statusSet = [...new Set(taskStatuses?.map(t => t.status))];
console.log('tasks status 值:', statusSet);

// 检查 profiles 实际列
const { data: p } = await OLD.from('profiles').select('*').limit(1);
if (p?.[0]) console.log('\nprofiles 列:', Object.keys(p[0]));
