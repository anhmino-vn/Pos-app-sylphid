import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Load Supabase Config
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncData() {
  console.log('--- BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU ---');

  try {
    // 1. SYNC CATEGORIES & PRODUCTS
    console.log('Đang lấy dữ liệu Products từ Firebase...');
    const productsSnapshot = await getDocs(collection(firestore, 'products'));
    const rawProducts = productsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        name: data.name || 'Unnamed Product',
        sku: data.sku || ('SKU-' + Date.now() + Math.floor(Math.random() * 1000)), // ensure unique SKU
        barcode: data.barcode || null,
        list_price: data.listPrice || 0,
        sale_price: data.salePrice || 0,
        stock: data.stock || 0,
        description: data.description || '',
        images: Array.isArray(data.images) ? data.images : [],
        category_name: typeof data.category === 'string' ? data.category : (data.category?.name || 'Không phân loại'),
        status: data.status || 'active',
      };
    });

    console.log(`Đã lấy ${rawProducts.length} Products từ Firebase.`);

    if (rawProducts.length > 0) {
       console.log('Đang tạo và ánh xạ Danh mục Sản phẩm (Categories)...');
       const categoryMap = {};
       const { data: existingCategories } = await supabase.from('categories').select('*');
       for (const cat of existingCategories || []) {
         categoryMap[cat.name] = cat.id;
       }

       for (const p of rawProducts) {
         if (p.category_name) {
           if (!categoryMap[p.category_name]) {
             console.log(`Tạo danh mục sản phẩm mới: ${p.category_name}`);
             const { data: newCat, error: catErr } = await supabase.from('categories').insert({ name: p.category_name }).select().single();
             if (catErr) throw catErr;
             categoryMap[p.category_name] = newCat.id;
           }
           p.category_id = categoryMap[p.category_name];
         }
         delete p.category_name; // Remove before inserting to Supabase
       }

       console.log('Đang chèn vào Supabase Products...');
       const { error: pError } = await supabase.from('products').insert(rawProducts);
       if (pError) throw pError;
       console.log('Đồng bộ Products thành công!');
    }

    // 2. SYNC SERVICE CATEGORIES & SERVICES
    console.log('Đang lấy dữ liệu Services từ Firebase...');
    const servicesSnapshot = await getDocs(collection(firestore, 'services'));
    const rawServices = servicesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        name: data.name || 'Unnamed Service',
        code: data.code || ('SVC-' + Date.now() + Math.floor(Math.random() * 1000)),
        category_name: typeof data.categoryName === 'string' ? data.categoryName : (typeof data.category === 'string' ? data.category : 'Không phân loại'),
        price: data.price || 0,
        promo_price: data.promoPrice || null,
        duration: data.duration || 60,
        description: data.description || '',
        images: Array.isArray(data.images) ? data.images : [],
        status: data.status || 'active',
        internal_notes: data.internalNotes || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
      };
    });

    console.log(`Đã lấy ${rawServices.length} Services từ Firebase.`);

    if (rawServices.length > 0) {
       console.log('Đang tạo và ánh xạ Danh mục Dịch vụ (Service Categories)...');
       const svcCategoryMap = {};
       const { data: existingSvcCats } = await supabase.from('service_categories').select('*');
       for (const cat of existingSvcCats || []) {
         svcCategoryMap[cat.name] = cat.id;
       }

       for (const s of rawServices) {
         if (s.category_name) {
           if (!svcCategoryMap[s.category_name]) {
             console.log(`Tạo danh mục dịch vụ mới: ${s.category_name}`);
             const { data: newCat, error: catErr } = await supabase.from('service_categories').insert({ name: s.category_name }).select().single();
             if (catErr) throw catErr;
             svcCategoryMap[s.category_name] = newCat.id;
           }
           s.category_id = svcCategoryMap[s.category_name];
         }
         delete s.category_name; // Remove before inserting to Supabase
       }

       console.log('Đang chèn vào Supabase Services...');
       const { error: sError } = await supabase.from('services').insert(rawServices);
       if (sError) throw sError;
       console.log('Đồng bộ Services thành công!');
    }

    console.log('--- HOÀN TẤT ĐỒNG BỘ DỮ LIỆU ---');
    process.exit(0);

  } catch (err) {
    console.error('LỖI TRONG QUÁ TRÌNH ĐỒNG BỘ:', err);
    process.exit(1);
  }
}

syncData();
