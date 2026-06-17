import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function toUUID(str) {
  if (!str) return null;
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
    
    // Firebase Timestamps
    if (val && typeof val === 'object' && val.seconds !== undefined) {
      val = new Date(val.seconds * 1000).toISOString();
    }
    
    if (val === '') {
      val = null;
    } else if (key.endsWith('Id') || key.endsWith('By') || key === 'id' || key === 'parentId') {
      if (typeof val === 'string') val = toUUID(val);
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
          continue;
        }
      }
      throw error;
    }
    break;
  }
}

async function migrate() {
  console.log('Starting Migration...');
  
  // Login to Supabase first
  console.log('Logging into Supabase...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'temp_admin_migration@sylphid.com',
    password: 'Password123!'
  });
  
  const { error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'temp_admin_migration@sylphid.com',
    password: 'Password123!'
  });

  if (loginErr) {
    console.error('Failed to log into Supabase with temp account:', loginErr.message);
  } else {
    console.log('Logged into Supabase successfully with temp account!');
  }

  
  for (const { fb, sb } of collectionsToMigrate) {
    console.log(`Migrating ${fb} -> ${sb}...`);
    try {
      const snapshot = await getDocs(collection(db, fb));
      
      if (snapshot.empty) {
        console.log(`  No data found in ${fb}.`);
        continue;
      }
      
      const batch = [];
      snapshot.forEach(doc => {
        const data = transformData(doc.data());
        data.id = toUUID(doc.id);
        
        // Add defaults for NOT NULL columns
        if (sb === 'customers' && !data.phone) {
            data.phone = '0000000000';
        }
        
        // Move potentially missing fkeys to data
        const fkeysToMove = ['staff_id', 'created_by', 'updated_by', 'deleted_by', 'customer_id', 'service_id'];
        fkeysToMove.forEach(k => {
           if (data[k] !== undefined && data[k] !== null) {
              data.data = data.data || {};
              data.data[k] = data[k];
              delete data[k];
           }
        });
        
        batch.push(data);
      });
      
      await insertWithFallback(sb, batch);
      console.log(`  Migrated ${batch.length} records to ${sb}.`);
    } catch(e) {
      console.log(`  Failed to migrate ${fb}:`, e.message);
    }
  }
  
  console.log('Migration Complete!');
  process.exit(0);
}

migrate();
