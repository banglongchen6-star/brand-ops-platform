import { createClient } from '@supabase/supabase-js';

const OLD = createClient(
  'https://gqevvoftqskuuysofncu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZXZ2b2Z0cXNrdXV5c29mbmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjMyNzczOSwiZXhwIjoyMDkxOTAzNzM5fQ.orUlrSOY74tE2VszclkdVGFFypLB6z5idcNz1B3b0bc'
);

// 通过查第一行来推断列结构
const TABLES = ['tasks', 'content_trends', 'profiles', 'personal_notes', 'note_categories'];

for (const t of TABLES) {
  const { data, error } = await OLD.from(t).select('*').limit(1);
  if (error) {
    console.log(`❌ ${t}: ${error.message}`);
  } else if (data && data.length > 0) {
    console.log(`\n📋 ${t} 列：`);
    Object.keys(data[0]).forEach(k => console.log(`  - ${k}`));
  } else {
    // 空表，但还是能查到列结构
    console.log(`⏭️  ${t}: 空表（无法推断列）`);
  }
}
