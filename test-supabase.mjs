import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fdlbskgaogtbjrchtiso.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkbGJza2dhb2d0YmpyY2h0aXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzQwMjcsImV4cCI6MjA5NTgxMDAyN30.uEQs7QEFAe0DlDS-A6aNA7NT2CxyCh2SaG7s4dhH5vM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('payment_configs').select('*');
  console.log("Error:", error);
  console.log("Data:", data);
}

check();
