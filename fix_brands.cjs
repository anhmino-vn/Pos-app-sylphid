const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function fixDb() {
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_string: "ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS logo_url TEXT; ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS website TEXT; NOTIFY pgrst, 'reload schema';"
  });
  console.log('Error:', error);
}
fixDb();
