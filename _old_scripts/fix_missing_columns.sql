-- Lệnh bổ sung các cột còn thiếu cho bảng customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES public.customers(id);

-- Cập nhật lại cache cho API
NOTIFY pgrst, 'reload schema';
