import { supabase } from './src/lib/supabase';
import { convertToSupabaseData } from './src/lib/firebaseAdapter'; // We might need to copy logic if not exported

async function testInsert() {
  const { data: session } = await supabase.auth.getSession();
  console.log('Session user:', session?.session?.user?.id);

  const orderData = {
    customer_id: null,
    items: [],
    total_amount: 0,
    status: 'pending'
  };

  const { data, error } = await supabase.from('orders').insert(orderData).select();
  console.log('Error:', error);
  console.log('Data:', data);
}

testInsert();
