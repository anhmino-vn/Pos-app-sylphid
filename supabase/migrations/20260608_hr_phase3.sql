-- ==========================================
-- HR MODULE - PHASE 3 MIGRATION
-- Evaluations, Deductions, Payroll Additions
-- ==========================================

-- 1. ADD BASE SALARY TO USER PROFILES
-- We add base_salary to handle fixed monthly wages before commissions.
ALTER TABLE user_profiles
ADD COLUMN base_salary DECIMAL(15, 2) DEFAULT 0;

-- 2. EVALUATIONS & PENALTIES
CREATE TABLE hr_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'reward' (Thưởng), 'penalty' (Phạt), 'evaluation' (Đánh giá năng lực)
    date DATE NOT NULL,
    amount DECIMAL(15, 2) DEFAULT 0, -- Monetary value for reward/penalty
    score INTEGER, -- 1-100 score if it's an evaluation
    notes TEXT,
    reported_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_hr_evaluations_user ON hr_evaluations(user_id);
CREATE INDEX idx_hr_evaluations_date ON hr_evaluations(date);

-- Note: hr_payroll_slips already exists.
-- The calculation logic will sum up:
-- Base Salary + Commission (from orders/HrCommissionRules) + Bonus (HrKpiRecord + HrEvaluation[reward]) - Penalties (HrEvaluation[penalty])
