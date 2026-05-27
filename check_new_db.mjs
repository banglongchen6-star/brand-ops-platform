import { createClient } from '@supabase/supabase-js';

const NEW = createClient(
  'https://nxnfbshdqpbpmpikrvqi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bmZic2hkcXBicG1waWtydnFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2OTI3NCwiZXhwIjoyMDk1NDQ1Mjc0fQ.-TDzU5QLDw8zPGOeVePUC19k6-fZdYJpxgg8ZHqlfPU'
);

for (const t of ['profiles', 'content_hit_factors', 'content_trends', 'tasks']) {
  const { data, error } = await NEW.from(t).select('*').limit(1);
  if (error) console.log(`❌ ${t}: ${error.message}`);
  else console.log(`✅ ${t} 列:`, data?.[0] ? Object.keys(data[0]).join(', ') : '空表');
}
