-- Migration: Internal Enterprise Finance (Group Funds, P2P Debts, Split Bills)

CREATE TABLE IF NOT EXISTS public.internal_funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    manager_id UUID REFERENCES public.users(id),
    initial_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    total_income DECIMAL(15,2) DEFAULT 0,
    total_expense DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    members JSONB DEFAULT '[]'::JSONB, -- Array of User IDs who can view/use this fund
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.internal_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    fund_id UUID REFERENCES public.internal_funds(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(15,2) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    split_members JSONB DEFAULT '[]'::JSONB, -- For Bill Splitting: Array of user IDs
    payer_payee_id UUID REFERENCES public.users(id), -- User who submitted or received
    created_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    attachments JSONB DEFAULT '[]'::JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.internal_transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES public.internal_transactions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.internal_debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debtor_id UUID REFERENCES public.users(id) NOT NULL, -- Người nợ
    creditor_id UUID REFERENCES public.users(id), -- Người cho nợ (Nhân viên), có thể null nếu nợ Quỹ
    creditor_fund_id UUID REFERENCES public.internal_funds(id), -- Chủ nợ là Quỹ (nếu có)
    amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    reason TEXT,
    source_transaction_id UUID REFERENCES public.internal_transactions(id), -- Liên kết tới phiếu chi (chia tiền)
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.internal_debt_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES public.users(id) NOT NULL, -- Người gửi yêu cầu
    target_id UUID REFERENCES public.users(id) NOT NULL, -- Người nhận yêu cầu
    amount DECIMAL(15,2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('offset', 'payment')), -- offset: Đối trừ, payment: Báo cáo đã trả
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: Because we don't have direct DB access in the simulator, this file serves as documentation.
-- In `firebaseAdapter.ts`, we will treat these tables as standard collections.
