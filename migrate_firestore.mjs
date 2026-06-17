import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// 1. Init Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./firebase-admin-key.json', 'utf8'));
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// 2. Init Supabase
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function toUUID(str) {
  if (!str) return null;
  // If it's already a UUID, return it
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) return str;
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function transformData(docData) {
  const result = {};
  for (const key in docData) {
    let val = docData[key];
    
    // Convert Timestamps
    if (val && typeof val === 'object' && val._seconds !== undefined) {
      val = new Date(val._seconds * 1000).toISOString();
    }
    
    // Arrays of objects with IDs? Keep it simple for now
    if (Array.isArray(val)) {
       // if array of strings
       // leave it
    }
    
    // Map IDs to UUIDs
    if (key.endsWith('Id') || key.endsWith('By') || key === 'id' || key === 'parentId') {
      if (val === '') val = null;
      else if (typeof val === 'string') val = toUUID(val);
    }
    
    result[toSnakeCase(key)] = val;
  }
  return result;
}

const collectionsToMigrate = [
  { fb: 'userProfiles', sb: 'user_profiles' },
  { fb: 'roles', sb: 'roles' },
  { fb: 'productCategories', sb: 'product_categories' },
  { fb: 'categories', sb: 'categories' },
  { fb: 'serviceCategories', sb: 'service_categories' },
  { fb: 'brands', sb: 'brands' },
  { fb: 'products', sb: 'products' },
  { fb: 'services', sb: 'services' },
  { fb: 'customers', sb: 'customers' },
  { fb: 'bookings', sb: 'bookings' },
  { fb: 'orders', sb: 'orders' },
  { fb: 'customer_transactions', sb: 'customer_transactions' }
];

async function insertWithFallback(sbTable, records) {
  let currentRecords = [...records];
  
  while (currentRecords.length > 0) {
    const { data, error } = await supabase.from(sbTable).upsert(currentRecords);
    
    if (error) {
      if (error.code === 'PGRST204') {
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match) {
          const missingCol = match[1];
          console.log(`    Missing column '${missingCol}', moving to 'data' JSONB...`);
          currentRecords = currentRecords.map(rec => {
            if (rec[missingCol] !== undefined) {
              rec.data = rec.data || {};
              rec.data[missingCol] = rec[missingCol];
              delete rec[missingCol];
            }
            return rec;
          });
          continue; // retry
        }
      }
      
      // If it's another error, or we can't parse it, throw
      throw error;
    }
    break; // Success
  }
}

async function migrate() {
  console.log('Starting Migration...');
  
  for (const { fb, sb } of collectionsToMigrate) {
    console.log(`Migrating ${fb} -> ${sb}...`);
    try {
        const snapshot = await db.collection(fb).get();
        
        if (snapshot.empty) {
        console.log(`  No data found in ${fb}.`);
        continue;
        }
        
        const batch = [];
        snapshot.forEach(doc => {
        const data = transformData(doc.data());
        data.id = toUUID(doc.id);
        batch.push(data);
        });
        
        await insertWithFallback(sb, batch);
        console.log(`  Migrated ${batch.length} records to ${sb}.`);
    } catch(e) {
        console.log(`  Failed to migrate ${fb}:`, e.message);
    }
  }
  
  console.log('Migration Complete!');
}

migrate();
