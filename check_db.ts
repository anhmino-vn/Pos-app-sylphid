import { supabase } from './src/lib/supabase';
async function check() {
  const { data, error } = await supabase.from('orders').select('id, created_at, customer_name, status, total_amount').order('created_at', { ascending: false }).limit(5);
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}
check();
