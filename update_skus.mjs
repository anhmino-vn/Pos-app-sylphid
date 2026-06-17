
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('id, sku');
  if (error) { console.error(error); return; }
  let i = 1;
  for (const p of data) {
    if (p.sku && p.sku.startsWith('PRO-')) {
      const newSku = 'SP' + i.toString().padStart(4, '0');
      console.log('Update', p.sku, '->', newSku);
      await supabase.from('products').update({ sku: newSku }).eq('id', p.id);
      i++;
    } else if (p.sku && p.sku.startsWith('SP')) {
      i++;
    }
  }
  console.log('Done updating SKUs');
}
run();

