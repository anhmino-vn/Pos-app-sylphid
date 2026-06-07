-- Bật RLS cho bảng orders (nếu chưa bật)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Xóa các policy cũ nếu có để tránh trùng lặp (tuỳ chọn)
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.orders;

-- Tạo Policy cho phép INSERT
CREATE POLICY "Enable insert access for authenticated users" ON public.orders
    FOR INSERT TO authenticated WITH CHECK (true);

-- Tạo Policy cho phép SELECT
CREATE POLICY "Enable read access for all authenticated users" ON public.orders
    FOR SELECT TO authenticated USING (true);

-- Tạo Policy cho phép UPDATE
CREATE POLICY "Enable update access for authenticated users" ON public.orders
    FOR UPDATE TO authenticated USING (true);

-- Tạo Policy cho phép DELETE
CREATE POLICY "Enable delete access for authenticated users" ON public.orders
    FOR DELETE TO authenticated USING (true);
