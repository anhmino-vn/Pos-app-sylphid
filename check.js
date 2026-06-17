import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://fdlbskgaogtbjrchtiso.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkbGJza2dhb2d0YmpyY2h0aXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzQwMjcsImV4cCI6MjA5NTgxMDAyN30.uEQs7QEFAe0DlDS-A6aNA7NT2CxyCh2SaG7s4dhH5vM');

async function check() {
  const { data, error } = await supabase.from('customers').select('*').eq('is_deleted', true);
  console.log("Error:", error);
  console.log("Data length:", data?.length);
  if (data?.length > 0) {
    console.log("First deleted:", data[0]);
  }
}
check();
