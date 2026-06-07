-- 1. Suppliers (Nhà cung cấp)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    contact_person TEXT,
    debt_balance NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Price Rules (Quy tắc giá)
CREATE TABLE IF NOT EXISTS public.price_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('time_based', 'customer_group', 'branch', 'program')),
    value_type TEXT NOT NULL CHECK (value_type IN ('percentage', 'fixed', 'override')),
    value NUMERIC NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    conditions JSONB, -- stores branch_id, group_id, etc.
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Commission Rules (Quy tắc tích điểm & hoa hồng mặc định)
CREATE TABLE IF NOT EXISTS public.commission_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('points', 'product_commission', 'service_commission', 'referral', 'discount_policy')),
    name TEXT NOT NULL,
    description TEXT,
    value_type TEXT NOT NULL CHECK (value_type IN ('percentage', 'fixed')),
    value NUMERIC NOT NULL,
    is_global BOOLEAN DEFAULT true, -- default configuration
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint to products.supplier_id if it doesn't exist
ALTER TABLE public.products 
    ADD CONSTRAINT fk_supplier 
    FOREIGN KEY (supplier_id) 
    REFERENCES public.suppliers(id) ON DELETE SET NULL;
