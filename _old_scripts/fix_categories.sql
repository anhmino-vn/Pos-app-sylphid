-- Fix categories table schema to support new UI fields
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id),
ADD COLUMN IF NOT EXISTS sort_order integer;

-- Fix service_categories table schema to support new UI fields
ALTER TABLE public.service_categories
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.service_categories(id),
ADD COLUMN IF NOT EXISTS sort_order integer;

-- Optional: ensure brands also has needed columns if it doesn't already
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS image_url text;
