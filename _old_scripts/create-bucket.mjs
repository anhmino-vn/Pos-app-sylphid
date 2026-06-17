import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createBucket() {
  const { data, error } = await supabase.storage.createBucket('health-assets', {
    public: true,
    fileSizeLimit: 10485760 // 10MB
  });

  if (error) {
    console.error("Error creating bucket:", error);
  } else {
    console.log("Bucket created successfully:", data);
  }
}

createBucket();
