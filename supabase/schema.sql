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
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_imports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_exports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guide_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
