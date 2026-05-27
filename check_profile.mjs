import { createClient } from '@supabase/supabase-js';

const NEW = createClient(
  'https://nxnfbshdqpbpmpikrvqi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bmZic2hkcXBicG1waWtydnFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg2OTI3NCwiZXhwIjoyMDk1NDQ1Mjc0fQ.-TDzU5QLDw8zPGOeVePUC19k6-fZdYJpxgg8ZHqlfPU'
);

const { data, error } = await NEW.from('profiles').select('*');
if (error) console.log('错误:', error);
else console.log('profiles 表数据:', data);
