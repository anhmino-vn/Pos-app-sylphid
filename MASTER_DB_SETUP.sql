-- SYLPHID MASTER DATABASE SETUP SCRIPT
-- Gộp toàn bộ Schema, Các bảng mở rộng, Bảo mật và Xả Cache

-- Supabase Schema for POS Application
-- Based on the existing Firebase models

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  manager_id UUID, -- References users(id) later
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Users/Staff Profiles Table (Extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY, -- References auth.users
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  avatar_url TEXT,
  employee_code TEXT,
  dob DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  address TEXT,
  id_card TEXT,
  join_date DATE,
  position TEXT,
  department_id UUID REFERENCES public.departments(id),
  role_id UUID REFERENCES public.roles(id),
  work_status TEXT CHECK (work_status IN ('working', 'probation', 'resigned', 'on_leave')) DEFAULT 'working',
  notes TEXT,
  role TEXT CHECK (role IN ('admin', 'staff')) DEFAULT 'staff', -- Legacy fallback
  shop_name TEXT,
  status TEXT CHECK (status IN ('active', 'locked')) DEFAULT 'active',
  custom_permissions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  list_price NUMERIC NOT NULL DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  images JSONB DEFAULT '[]', -- Array of image URLs
  category_id UUID REFERENCES public.categories(id),
  status TEXT CHECK (status IN ('active', 'out_of_stock', 'discontinued')) DEFAULT 'active',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  gender TEXT,
  birth_date DATE,
  note TEXT,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  total_spend NUMERIC DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,
  tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond')) DEFAULT 'bronze',
  in_charge_staff_id UUID REFERENCES public.user_profiles(id),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]', -- Order items array
  subtotal NUMERIC,
  total_amount NUMERIC NOT NULL,
  referred_by_id UUID REFERENCES public.customers(id),
  referred_by_name TEXT,
  commission_eligible BOOLEAN DEFAULT FALSE,
  commission_percent NUMERIC,
  commission_amount NUMERIC,
  commission_status TEXT CHECK (commission_status IN ('unpaid', 'paid', 'cancelled')),
  commission_paid_at TIMESTAMPTZ,
  discount NUMERIC DEFAULT 0,
  shipping_fee NUMERIC DEFAULT 0,
  payment_method TEXT,
  amount_given NUMERIC,
  change_given NUMERIC,
  status TEXT CHECK (status IN ('pending', 'unpaid', 'paid', 'cancelled')) DEFAULT 'pending',
  note TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  creator_name TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Customer Transactions Table
CREATE TABLE IF NOT EXISTS public.customer_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id),
  order_id UUID REFERENCES public.orders(id),
  total_amount NUMERIC NOT NULL,
  status TEXT,
  order_date TIMESTAMPTZ NOT NULL,
  items_overview TEXT,
  created_by UUID REFERENCES public.user_profiles(id)
);

-- 9. Service Categories Table
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Services Table
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES public.service_categories(id),
  price NUMERIC NOT NULL,
  promo_price NUMERIC,
  duration INTEGER NOT NULL, -- minutes
  description TEXT,
  images JSONB DEFAULT '[]',
  status TEXT CHECK (status IN ('active', 'hidden')) DEFAULT 'active',
  internal_notes TEXT,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  service_id UUID REFERENCES public.services(id),
  service_name TEXT,
  staff_id UUID REFERENCES public.user_profiles(id),
  staff_name TEXT,
  room_id UUID, -- If rooms are added later
  room_name TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  notes TEXT,
  total_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Inventory Logs Table
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  type TEXT CHECK (type IN ('in', 'out', 'adjustment')) NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Stock Imports Table
CREATE TABLE IF NOT EXISTS public.stock_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.suppliers(id),
  supplier_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC NOT NULL,
  notes TEXT,
  status TEXT CHECK (status IN ('completed', 'cancelled')) DEFAULT 'completed',
  created_by UUID REFERENCES public.user_profiles(id),
  creator_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Stock Exports Table
CREATE TABLE IF NOT EXISTS public.stock_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  reason TEXT CHECK (reason IN ('order', 'internal', 'damage', 'other')) NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  status TEXT CHECK (status IN ('completed', 'cancelled')) DEFAULT 'completed',
  created_by UUID REFERENCES public.user_profiles(id),
  creator_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Guide Categories Table
CREATE TABLE IF NOT EXISTS public.guide_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Guides Table
CREATE TABLE IF NOT EXISTS public.guides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES public.guide_categories(id),
  description TEXT,
  content TEXT,
  file_url TEXT,
  file_type TEXT,
  file_name TEXT,
  thumbnail_url TEXT,
  created_by UUID REFERENCES public.user_profiles(id),
  creator_name TEXT,
  status TEXT CHECK (status IN ('active', 'hidden')) DEFAULT 'active',
  tags JSONB DEFAULT '[]',
  views INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id),
  user_email TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  module TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =======================================================
-- ENABLE REALTIME FOR ALL RELEVANT TABLES
-- =======================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'departments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'roles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.roles;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_transactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_transactions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.service_categories;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'services'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inventory_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_logs;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'suppliers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stock_imports'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_imports;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stock_exports'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_exports;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'guide_categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.guide_categories;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'guides'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.guides;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


-- 19. Debt Payments Table
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  notes TEXT,
  order_ids JSONB DEFAULT '[]',
  created_by UUID REFERENCES public.user_profiles(id),
  creator_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'debt_payments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.debt_payments;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


-- 20. System Configs Table
CREATE TABLE IF NOT EXISTS public.system_configs (
  id TEXT PRIMARY KEY,
  business JSONB,
  invoice JSONB,
  payment JSONB,
  inventory JSONB,
  referral JSONB,
  ui JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_configs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;



-- BẢNG TRANSACTIONS (SỔ QUỸ & DÒNG TIỀN)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC NOT NULL DEFAULT 0,
    category VARCHAR(255) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'card')),
    description TEXT,
    reference_id UUID,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- THÊM CỘT CÔNG NỢ CHO BẢNG CUSTOMERS
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_debt NUMERIC DEFAULT 0;

-- CẬP NHẬT RLS (ROW LEVEL SECURITY) CHO BẢNG TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.transactions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.transactions
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON public.transactions
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON public.transactions
    FOR DELETE TO authenticated USING (true);


-- ==========================================
-- EXTRA TABLES FOR FULL SYSTEM COMPATIBILITY
-- ==========================================


CREATE TABLE IF NOT EXISTS public.brands (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'brands'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.brands;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.product_variants (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'product_variants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.service_combos (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_combos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.service_combos;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.treatment_courses (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'treatment_courses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_courses;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.customer_treatment_courses (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customer_treatment_courses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_treatment_courses;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.inventory_transactions (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inventory_transactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_transactions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.price_rules (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'price_rules'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.price_rules;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.commission_rules (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'commission_rules'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_rules;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.health_records (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'health_records'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.health_records;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.treatment_plans (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'treatment_plans'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_plans;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.therapy_logs (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'therapy_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.therapy_logs;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.health_evaluations (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'health_evaluations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.health_evaluations;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.hr_shifts (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hr_shifts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_shifts;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.hr_shift_registrations (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hr_shift_registrations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_shift_registrations;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.hr_attendance (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hr_attendance'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_attendance;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.hr_commission_rules (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hr_commission_rules'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_commission_rules;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.hr_payroll_slips (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hr_payroll_slips'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_payroll_slips;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.hr_kpi_targets (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hr_kpi_targets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_kpi_targets;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.hr_kpi_records (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hr_kpi_records'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_kpi_records;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.hr_leave_requests (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hr_leave_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_leave_requests;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.hr_evaluations (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'hr_evaluations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_evaluations;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.debts (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'debts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.budgets (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budgets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.cost_allocations (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cost_allocations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_allocations;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.internal_funds (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'internal_funds'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_funds;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.internal_transactions (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'internal_transactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_transactions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.internal_transaction_items (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'internal_transaction_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_transaction_items;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.internal_debts (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'internal_debts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_debts;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;


CREATE TABLE IF NOT EXISTS public.internal_debt_requests (
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'internal_debt_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_debt_requests;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;




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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_configs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if already added or other errors
END $$;

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
