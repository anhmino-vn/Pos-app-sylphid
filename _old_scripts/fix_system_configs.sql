-- 1. Tạo bảng system_configs nếu chưa có
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

-- 2. Bật Realtime cho bảng này
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;

-- 3. Bật RLS và cấp quyền cho tất cả (như fix_database.sql đã làm với các bảng khác)
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bypass_RLS_All" ON public.system_configs;
CREATE POLICY "Bypass_RLS_All" ON public.system_configs FOR ALL USING (true) WITH CHECK (true);

-- 4. Chèn dữ liệu mặc định để không bị lỗi
INSERT INTO public.system_configs (id, business, invoice, payment, inventory, referral, ui)
VALUES (
  'global', 
  '{"name": "SYLPHID", "tax_id": "", "hotline": "", "email": "", "website": "", "address": ""}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 5. Làm mới lại bộ đệm API của Supabase
NOTIFY pgrst, 'reload schema';
