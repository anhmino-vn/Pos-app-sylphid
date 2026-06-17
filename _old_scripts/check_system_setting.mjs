import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTable() {
    const { data, error } = await supabase.from('SystemSetting').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success, data in SystemSetting:', data);
    }
}

checkTable();
