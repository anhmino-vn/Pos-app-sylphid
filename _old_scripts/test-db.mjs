import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log(`Connecting to ${supabaseUrl}`);
  
  // Use a raw REST query to information schema is not directly allowed via JS SDK sometimes,
  // but we can just use the supabase RPC or query a known table if we had it.
  // Instead, let's fetch from the PostgREST root endpoint using fetch.
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const schema = await res.json();
    console.log("Raw REST schema response keys:", Object.keys(schema));
    if (schema.paths) {
       console.log("Available paths:", Object.keys(schema.paths).filter(p => p !== '/').join(', '));
    } else {
       console.log("Schema response:", JSON.stringify(schema).substring(0, 500));
    }
  } catch (err) {
    console.error(err);
  }
}

checkTables();
