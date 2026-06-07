-- 1. ProductCategory (Danh mục sản phẩm)
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    description TEXT,
    slug TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Brand (Thương hiệu)
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Product (Sản phẩm gốc)
-- Modify existing if exists or create new
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    short_name TEXT,
    category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
    description TEXT,
    seo_description TEXT,
    images TEXT[],
    video_url TEXT,
    base_unit TEXT DEFAULT 'Cái',
    supplier_id UUID, -- References suppliers table if exist
    supplier_name TEXT,
    weight NUMERIC DEFAULT 0,
    dimensions JSONB,
    tags TEXT[],
    note TEXT,
    tax_rate NUMERIC DEFAULT 0,
    is_combo BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Legacy columns
    sku TEXT,
    barcode TEXT,
    list_price NUMERIC DEFAULT 0,
    sale_price NUMERIC DEFAULT 0,
    stock INT DEFAULT 0,
    category TEXT
);

-- 4. ProductVariant (Biến thể sản phẩm)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    barcode TEXT,
    qr_code TEXT,
    name TEXT NOT NULL,
    attributes JSONB,
    cost_price NUMERIC DEFAULT 0,
    list_price NUMERIC DEFAULT 0,
    sale_price NUMERIC NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    min_stock INT DEFAULT 0,
    max_stock INT,
    image_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. InventoryTransaction (Giao dịch kho)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id),
    type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjust')),
    quantity INT NOT NULL,
    balance_after INT,
    reference_id UUID,
    reference_type TEXT,
    note TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. ServiceCombo (Combo dịch vụ)
CREATE TABLE IF NOT EXISTS public.service_combos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    price NUMERIC NOT NULL,
    promo_price NUMERIC,
    service_ids UUID[],
    description TEXT,
    images TEXT[],
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TreatmentCourse (Liệu trình mẫu)
CREATE TABLE IF NOT EXISTS public.treatment_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    sessions INT NOT NULL,
    duration INT,
    service_ids UUID[],
    price NUMERIC NOT NULL,
    promo_price NUMERIC,
    note TEXT,
    images TEXT[],
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. CustomerTreatmentCourse (Liệu trình của khách hàng)
CREATE TABLE IF NOT EXISTS public.customer_treatment_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL, -- references customers(id)
    course_id UUID NOT NULL REFERENCES public.treatment_courses(id),
    order_id UUID, -- references orders(id)
    total_sessions INT NOT NULL,
    used_sessions INT DEFAULT 0,
    remaining_sessions INT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger for remaining_sessions
CREATE OR REPLACE FUNCTION update_remaining_sessions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.remaining_sessions = NEW.total_sessions - NEW.used_sessions;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_remaining_sessions ON public.customer_treatment_courses;
CREATE TRIGGER trigger_update_remaining_sessions
BEFORE INSERT OR UPDATE ON public.customer_treatment_courses
FOR EACH ROW
EXECUTE FUNCTION update_remaining_sessions();
