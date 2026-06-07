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
