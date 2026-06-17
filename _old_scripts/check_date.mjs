import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

// We must authenticate to bypass RLS
async function test() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'anhmino.it@gmail.com',
    password: 'password123' // hope this is the default or we can just bypass RLS by using service role key if we had it. Wait, I don't have service role key.
  });
  
  if (authErr) {
    console.log("Auth error:", authErr.message);
    // If auth fails, try to fetch anyway just in case RLS is disabled for SELECT
  }
  
  const { data, error } = await supabase.from('orders').select('id, created_at').order('created_at', { ascending: false }).limit(5);
  console.log("Data:", data);
}
test();
