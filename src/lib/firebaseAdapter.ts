import { supabase } from './supabase';

const tableNameMap: Record<string, string> = {
  'orders': 'orders',
  'products': 'products',
  'services': 'services',
  'customers': 'customers',
  'inventoryLogs': 'inventory_logs',
  'guides': 'guides',
  'activity_logs': 'activity_logs',
  'users': 'user_profiles',
  'roles': 'roles',
  'categories': 'categories',
  'serviceCategories': 'service_categories',
  'productCategories': 'categories',
  'brands': 'brands',
  'productVariants': 'product_variants',
  'serviceCombos': 'service_combos',
  'treatmentCourses': 'treatment_courses',
  'customerTreatmentCourses': 'customer_treatment_courses',
  'inventoryTransactions': 'inventory_transactions',
  'guideCategories': 'guide_categories',
  'customer_transactions': 'customer_transactions',
  'bookings': 'bookings',
  'suppliers': 'suppliers',
  'stockImports': 'stock_imports',
  'stockExports': 'stock_exports',
  'priceRules': 'price_rules',
  'commissionRules': 'commission_rules',
  'healthRecords': 'health_records',
  'treatmentPlans': 'treatment_plans',
  'therapyLogs': 'therapy_logs',
  'healthEvaluations': 'health_evaluations',
  'hrShifts': 'hr_shifts',
  'hrShiftRegistrations': 'hr_shift_registrations',
  'hrAttendance': 'hr_attendance',
  'hrCommissionRules': 'hr_commission_rules',
  'hrPayrollSlips': 'hr_payroll_slips',
  'hr_attendance': 'hr_attendance',
  'hr_payroll_slips': 'hr_payroll_slips',
  'hr_kpi_targets': 'hr_kpi_targets',
  'hr_kpi_records': 'hr_kpi_records',
  'hr_leave_requests': 'hr_leave_requests',
  'hr_evaluations': 'hr_evaluations',
  'transactions': 'transactions',
  'debts': 'debts',
  'budgets': 'budgets',
  'costAllocations': 'cost_allocations',
  'internalFunds': 'internal_funds',
  'internalTransactions': 'internal_transactions',
  'internalTransactionItems': 'internal_transaction_items',
  'internalDebts': 'internal_debts',
  'internalDebtRequests': 'internal_debt_requests'
};

const mapTableName = (name: string) => tableNameMap[name] || name;

// Map camelCase keys to snake_case for Supabase
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

const convertToSupabaseData = (data: any) => {
  const result: any = {};
  for (const key in data) {
    if (key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt' || key === 'commissionPaidAt') {
      if (data[key] === 'SERVER_TIMESTAMP') {
        result[toSnakeCase(key)] = new Date().toISOString();
      } else if (data[key] && typeof data[key].toDate === 'function') {
        result[toSnakeCase(key)] = data[key].toDate().toISOString();
      } else {
        result[toSnakeCase(key)] = data[key];
      }
    } else {
      let val = data[key];
      // Supabase UUID columns will throw fatal error if we pass empty string ""
      if (val === '' && (key.endsWith('Id') || key.endsWith('By') || key === 'id')) {
        val = null;
      }
      result[toSnakeCase(key)] = val;
    }
  }
  return result;
};

const convertToFirebaseData = (data: any) => {
  if (data === null || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => convertToFirebaseData(item));
  }

  const result: any = {};
  for (const key in data) {
    let newKey = toCamelCase(key);
    let originalVal = data[key];
    
    // Handle timestamps
    if ((key.endsWith('_at') || key === 'dob' || key === 'join_date' || key === 'booking_date' || key === 'order_date') && originalVal) {
       result[newKey] = { toDate: () => new Date(originalVal) };
    } else {
       result[newKey] = convertToFirebaseData(originalVal);
    }
  }
  return result;
};

export const collection = (db: any, path: string) => ({ path });
export const doc = (dbOrCol: any, pathOrId?: string, ...rest: any[]) => {
   if (typeof dbOrCol === 'string') { // doc(db, 'users', id)
      // wait, db is usually passed as first arg. 
      // signature: doc(db, 'users', '123')
      return { path: pathOrId, id: rest[0] };
   }
   if (dbOrCol.path) { // doc(collection(db, 'users'))
      return { path: dbOrCol.path, id: pathOrId || crypto.randomUUID() };
   }
   // Assuming dbOrCol is db
   return { path: pathOrId, id: rest[0] || crypto.randomUUID() };
};

export const query = (col: any, ...constraints: any[]) => ({ path: col.path, constraints });

export const orderBy = (field: string, direction: 'asc'|'desc' = 'asc') => ({ type: 'orderBy', field: toSnakeCase(field), direction });
export const where = (field: string, op: string, value: any) => ({ type: 'where', field: toSnakeCase(field), op, value });
export const limit = (l: number) => ({ type: 'limit', value: l });

export const serverTimestamp = () => 'SERVER_TIMESTAMP';
export const Timestamp = {
   fromDate: (date: Date) => date.toISOString(),
   now: () => new Date().toISOString()
};

const applyQueryConstraints = (builder: any, constraints: any[]) => {
  if (!constraints) return builder;
  for (const c of constraints) {
    if (c.type === 'orderBy') builder = builder.order(c.field, { ascending: c.direction === 'asc' });
    if (c.type === 'limit') builder = builder.limit(c.value);
    if (c.type === 'where') {
       if (c.op === '==') builder = builder.eq(c.field, c.value);
       if (c.op === '!=') builder = builder.neq(c.field, c.value);
       if (c.op === '>') builder = builder.gt(c.field, c.value);
       if (c.op === '>=') builder = builder.gte(c.field, c.value);
       if (c.op === '<') builder = builder.lt(c.field, c.value);
       if (c.op === '<=') builder = builder.lte(c.field, c.value);
       if (c.op === 'in') builder = builder.in(c.field, c.value);
       if (c.op === 'array-contains') builder = builder.contains(c.field, [c.value]);
    }
  }
  return builder;
};

export const getDocs = async (q: any) => {
  const table = mapTableName(q.path);
  let builder = supabase.from(table).select('*');
  builder = applyQueryConstraints(builder, q.constraints);
  const { data, error } = await builder;
  if (error) throw error;
  
  return {
    empty: !data || data.length === 0,
    docs: (data || []).map((d: any) => ({
      id: d.id,
      data: () => convertToFirebaseData(d),
      ref: { id: d.id, path: q.path }
    }))
  };
};

export const getDoc = async (docRef: any) => {
  const table = mapTableName(docRef.path);
  const { data, error } = await supabase.from(table).select('*').eq('id', docRef.id).single();
  
  if (error && error.code !== 'PGRST116') throw error;
  
  return {
    exists: () => !!data,
    id: docRef.id,
    data: () => data ? convertToFirebaseData(data) : undefined,
    ref: docRef
  };
};

export const addDoc = async (colRef: any, data: any) => {
  const table = mapTableName(colRef.path);
  const insertData = convertToSupabaseData(data);
  const { data: res, error } = await supabase.from(table).insert(insertData).select('id').single();
  if (error) throw error;
  return { id: res.id, path: colRef.path };
};

export const setDoc = async (docRef: any, data: any, options: { merge?: boolean } = {}) => {
  const table = mapTableName(docRef.path);
  const insertData = convertToSupabaseData(data);
  insertData.id = docRef.id;
  
  // Upsert basically handles both set and merge in Supabase if we don't strictly enforce old rows
  const { error } = await supabase.from(table).upsert(insertData);
  if (error) throw error;
};

export const updateDoc = async (docRef: any, data: any) => {
  const table = mapTableName(docRef.path);
  const updateData = convertToSupabaseData(data);
  const { error } = await supabase.from(table).update(updateData).eq('id', docRef.id);
  if (error) throw error;
};

export const deleteDoc = async (docRef: any) => {
  const table = mapTableName(docRef.path);
  const { error } = await supabase.from(table).delete().eq('id', docRef.id);
  if (error) throw error;
};

export const onSnapshot = (q: any, onNext: (snapshot: any) => void, onError?: (err: any) => void) => {
  const table = mapTableName(q.path);
  
  const fetchAndNotify = async () => {
    try {
      let builder = supabase.from(table).select('*');
      
      if (q.id && !q.constraints) {
         builder = builder.eq('id', q.id).maybeSingle();
         const { data, error } = await builder;
         if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error;
         
         onNext({
           exists: () => !!data,
           id: q.id,
           data: () => data ? convertToFirebaseData(data) : undefined,
           ref: q
         });
      } else {
         builder = applyQueryConstraints(builder, q.constraints);
         const { data, error } = await builder;
         if (error && error.code !== '42P01') throw error;
         
         onNext({
           empty: !data || data.length === 0,
           docs: (data || []).map((d: any) => ({
             id: d.id,
             data: () => convertToFirebaseData(d),
             ref: { id: d.id, path: q.path }
           }))
         });
      }
    } catch (err) {
      if (onError) onError(err);
    }
  };

  fetchAndNotify();

  const channelId = crypto.randomUUID();
  const channel = supabase.channel(`public:${table}:${channelId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, () => {
      fetchAndNotify();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const writeBatch = (db: any) => {
  const operations: any[] = [];
  
  return {
    set: (docRef: any, data: any) => {
      operations.push({ type: 'upsert', table: mapTableName(docRef.path), data: { ...convertToSupabaseData(data), id: docRef.id } });
    },
    update: (docRef: any, data: any) => {
      operations.push({ type: 'update', table: mapTableName(docRef.path), id: docRef.id, data: convertToSupabaseData(data) });
    },
    delete: (docRef: any) => {
      operations.push({ type: 'delete', table: mapTableName(docRef.path), id: docRef.id });
    },
    commit: async () => {
      // Supabase doesn't have a multi-table bulk operation via standard REST API without RPC.
      // So we will execute them sequentially for this compatibility layer.
      for (const op of operations) {
        if (op.type === 'upsert') {
          const { error } = await supabase.from(op.table).upsert(op.data);
          if (error) throw error;
        } else if (op.type === 'update') {
          const { error } = await supabase.from(op.table).update(op.data).eq('id', op.id);
          if (error) throw error;
        } else if (op.type === 'delete') {
          const { error } = await supabase.from(op.table).delete().eq('id', op.id);
          if (error) throw error;
        }
      }
    }
  };
};

export const storage = supabase.storage;
export const ref = (storageObj: any, path: string) => ({ path });
export const uploadBytesResumable = (storageRef: any, file: any) => {
  const task = {
    on: (event: string, onProgress: any, onError: any, onSuccess: any) => {
      if (onProgress) onProgress({ bytesTransferred: 0, totalBytes: file.size });
      supabase.storage.from('uploads').upload(storageRef.path, file, { upsert: true })
        .then(({ data, error }) => {
          if (error) {
             if (onError) onError(error);
          } else {
             if (onProgress) onProgress({ bytesTransferred: file.size, totalBytes: file.size });
             if (onSuccess) onSuccess();
          }
        });
    }
  };
  return task;
};

export const getDownloadURL = async (storageRef: any) => {
  const { data } = supabase.storage.from('uploads').getPublicUrl(storageRef.path);
  return data.publicUrl;
};

export const deleteObject = async (storageRef: any) => {
  await supabase.storage.from('uploads').remove([storageRef.path]);
};
