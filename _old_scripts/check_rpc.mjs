import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRpc() {
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: 'SELECT 1;' });
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success, data:', data);
    }
}

checkRpc();
