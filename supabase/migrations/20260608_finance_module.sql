-- ==========================================
-- FINANCE MODULE DATABASE SCHEMA
-- ==========================================

-- Bảng lưu giao dịch (Phiếu thu / Phiếu chi)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE, -- Mã phiếu, VD: PT001, PC001
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(100) NOT NULL, -- Bán hàng, Thu nợ, Marketing, Lương...
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash', -- cash, transfer, e-wallet, card
    payer_receiver VARCHAR(255), -- Người nộp / Người nhận
    phone VARCHAR(20),
    description TEXT,
    status VARCHAR(50) DEFAULT 'completed', -- completed, pending, cancelled
    is_approved BOOLEAN DEFAULT false, -- Cờ duyệt chi (Approval flag) trên UI
    attachment_url TEXT,
    reference_id UUID, -- Liên kết với đơn hàng / liệu trình / NCC
    is_deleted BOOLEAN DEFAULT false, -- Soft delete cho Thùng rác
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Bảng quản lý Công nợ (Debts)
CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('customer', 'supplier')),
    partner_id UUID NOT NULL, -- ID của khách hàng hoặc nhà cung cấp
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    due_date TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, partial, paid
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Bảng quản lý Ngân sách (Budget Planning)
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(100) NOT NULL, -- Marketing, Vận hành...
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    month INT NOT NULL,
    year INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Bảng phân bổ chi phí (Cost Allocation)
CREATE TABLE IF NOT EXISTS cost_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID, -- Liên kết với sản phẩm hoặc dịch vụ
    percentage DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Tỷ lệ phân bổ (%)
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Số tiền tương ứng
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_allocations ENABLE ROW LEVEL SECURITY;

-- Policies (Cho phép Admin toàn quyền, có thể tùy chỉnh thêm theo role sau)
CREATE POLICY "Full access to transactions" ON transactions FOR ALL USING (true);
CREATE POLICY "Full access to debts" ON debts FOR ALL USING (true);
CREATE POLICY "Full access to budgets" ON budgets FOR ALL USING (true);
CREATE POLICY "Full access to cost_allocations" ON cost_allocations FOR ALL USING (true);
