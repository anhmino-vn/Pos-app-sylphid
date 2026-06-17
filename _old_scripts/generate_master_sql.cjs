const fs = require('fs');

const schemaSql = fs.existsSync('supabase/schema.sql') ? fs.readFileSync('supabase/schema.sql', 'utf8') : '';
const dbSchemaSql = fs.existsSync('database_schema.sql') ? fs.readFileSync('database_schema.sql', 'utf8') : '';

const adapterMapStr = `
  'brands': 'brands',
  'productVariants': 'product_variants',
  'serviceCombos': 'service_combos',
  'treatmentCourses': 'treatment_courses',
  'customerTreatmentCourses': 'customer_treatment_courses',
  'inventoryTransactions': 'inventory_transactions',
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
  'hr_kpi_targets': 'hr_kpi_targets',
  'hr_kpi_records': 'hr_kpi_records',
  'hr_leave_requests': 'hr_leave_requests',
  'hr_evaluations': 'hr_evaluations',
  'debts': 'debts',
  'budgets': 'budgets',
  'costAllocations': 'cost_allocations',
  'internalFunds': 'internal_funds',
  'internalTransactions': 'internal_transactions',
  'internalTransactionItems': 'internal_transaction_items',
  'internalDebts': 'internal_debts',
  'internalDebtRequests': 'internal_debt_requests'
`;

const missingTablesMatches = [...adapterMapStr.matchAll(/'[^']+':\s*'([^']+)'/g)];
const missingTables = missingTablesMatches.map(m => m[1]);

let extraTablesSql = '-- ==========================================\n-- EXTRA TABLES FOR FULL SYSTEM COMPATIBILITY\n-- ==========================================\n\n';

missingTables.forEach(table => {
    extraTablesSql += `
CREATE TABLE IF NOT EXISTS public.${table} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  code TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  type TEXT,
  amount NUMERIC DEFAULT 0,
  date TIMESTAMPTZ,
  notes TEXT,
  items JSONB DEFAULT '[]',
  data JSONB DEFAULT '{}',
  customer_id UUID,
  staff_id UUID,
  product_id UUID,
  service_id UUID,
  reference_id UUID,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.${table};
`;
});

const addIsDeleted = `
-- ==========================================
-- ADD is_deleted TO ALL EXISTING TABLES
-- ==========================================
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || ' ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;';
        EXCEPTION WHEN duplicate_column THEN
        END;
        BEGIN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || ' ADD COLUMN deleted_at TIMESTAMPTZ;';
        EXCEPTION WHEN duplicate_column THEN
        END;
    END LOOP;
END $$;
`;

const rlsSql = `
-- ==========================================
-- SECURITY POLICY (RLS) - AUTHENTICATED ONLY
-- ==========================================
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || ' ENABLE ROW LEVEL SECURITY;';
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "Bypass_RLS_All" ON public.' || quote_ident(t_name) || ';';
        EXCEPTION WHEN others THEN END;
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "Enable_Auth_Access" ON public.' || quote_ident(t_name) || ';';
        EXCEPTION WHEN others THEN END;
        
        EXECUTE 'CREATE POLICY "Enable_Auth_Access" ON public.' || quote_ident(t_name) || ' FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'');';
    END LOOP;
END $$;
`;

const finalSql = `-- SYLPHID MASTER DATABASE SETUP SCRIPT
-- Gộp toàn bộ Schema, Các bảng mở rộng, Bảo mật và Xả Cache

${schemaSql}

${dbSchemaSql}

${extraTablesSql}

${addIsDeleted}

${rlsSql}

-- Sửa lỗi bảng system_configs
CREATE TABLE IF NOT EXISTS public.system_configs (
  id TEXT PRIMARY KEY,
  business JSONB,
  invoice JSONB,
  payment JSONB,
  inventory JSONB,
  referral JSONB,
  ui JSONB,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bypass_RLS_All" ON public.system_configs;
DROP POLICY IF EXISTS "Enable_Auth_Access" ON public.system_configs;
CREATE POLICY "Enable_Auth_Access" ON public.system_configs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

INSERT INTO public.system_configs (id, business, invoice, payment, inventory, referral, ui)
VALUES (
  'global', 
  '{"name": "SYLPHID", "tax_id": "", "hotline": "", "email": "", "website": "", "address": ""}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
`;

fs.writeFileSync('MASTER_DB_SETUP.sql', finalSql);
console.log('Successfully wrote MASTER_DB_SETUP.sql');
