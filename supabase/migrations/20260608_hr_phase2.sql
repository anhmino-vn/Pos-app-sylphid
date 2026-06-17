-- ==========================================
-- HR MODULE - PHASE 2 MIGRATION
-- KPI, Schedules (Leave Requests), Advanced Commissions
-- ==========================================

-- 1. KPI TARGETS
CREATE TABLE hr_kpi_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- e.g., "2026-06"
    role_type VARCHAR(50), -- e.g., "sale", "tech", "marketing"
    target_revenue DECIMAL(15, 2) DEFAULT 0,
    target_customers INTEGER DEFAULT 0,
    target_orders INTEGER DEFAULT 0,
    target_treatments INTEGER DEFAULT 0,
    target_leads INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_hr_kpi_targets_user ON hr_kpi_targets(user_id);
CREATE INDEX idx_hr_kpi_targets_month ON hr_kpi_targets(month);
CREATE UNIQUE INDEX idx_hr_kpi_targets_unique ON hr_kpi_targets(user_id, month);

-- 2. KPI RECORDS (Actual achievements)
CREATE TABLE hr_kpi_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    actual_revenue DECIMAL(15, 2) DEFAULT 0,
    actual_customers INTEGER DEFAULT 0,
    actual_orders INTEGER DEFAULT 0,
    actual_treatments INTEGER DEFAULT 0,
    actual_leads INTEGER DEFAULT 0,
    bonus_amount DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_hr_kpi_records_user ON hr_kpi_records(user_id);
CREATE INDEX idx_hr_kpi_records_month ON hr_kpi_records(month);
CREATE UNIQUE INDEX idx_hr_kpi_records_unique ON hr_kpi_records(user_id, month);

-- 3. LEAVE REQUESTS & SCHEDULE EXCEPTIONS
CREATE TABLE hr_leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type VARCHAR(50) NOT NULL, -- "sick", "annual", "unpaid", "personal"
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- "pending", "approved", "rejected"
    approved_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Note: hr_shifts and hr_shift_registrations already exist from Phase 1.
-- We will ensure 'morning', 'afternoon', 'evening' shifts are seeded.
-- We will also update hr_commission_rules type to accept 'referral' and 'treatment'.
