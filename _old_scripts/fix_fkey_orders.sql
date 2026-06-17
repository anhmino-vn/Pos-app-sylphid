-- 1. Bật RLS và cấp toàn quyền cho bảng user_profiles (để App.tsx có thể tự động thêm profile)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for user_profiles" ON public.user_profiles;
CREATE POLICY "Enable all access for user_profiles" ON public.user_profiles
    FOR ALL USING (true) WITH CHECK (true);

-- 2. Đồng bộ các tài khoản đang có trong auth.users sang bảng user_profiles
-- Điều này sẽ khắc phục trực tiếp lỗi "violates foreign key constraint orders_created_by_fkey"
INSERT INTO public.user_profiles (id, email, name, role, status)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', email) as name, 
    'admin' as role, 
    'active' as status
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles);
