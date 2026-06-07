import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data: orders, error: orderErr } = await supabase.from('orders').select('*');
  console.log("Orders count:", orders?.length, orderErr);
  if (orders?.length) console.log("First order ID:", orders[0].id);

  const { data: profiles } = await supabase.from('user_profiles').select('*');
  console.log("Profiles count:", profiles?.length);
}

run().catch(console.error);
