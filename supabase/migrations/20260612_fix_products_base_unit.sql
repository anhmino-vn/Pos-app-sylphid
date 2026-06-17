-- Fix: Add base_unit and other missing columns to products table
-- These columns may not exist if the table was created before the migration

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS base_unit TEXT DEFAULT 'Cái';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dimensions JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_combo BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
