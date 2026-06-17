-- HR Module Database Schema

-- 1. Shifts (Ca làm việc)
CREATE TABLE IF NOT EXISTS public.hr_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- 'Ca sáng', 'Ca chiều', 'Ca tối'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Shift Registrations (Đăng ký ca làm)
CREATE TABLE IF NOT EXISTS public.hr_shift_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.hr_shifts(id),
    date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, shift_id, date)
);

-- 3. Attendance Records (Chấm công)
CREATE TABLE IF NOT EXISTS public.hr_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.hr_shifts(id),
    date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'on_time' CHECK (status IN ('on_time', 'late', 'early_leave', 'absent', 'leave')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 4. Commission Rules (Luật hoa hồng)
CREATE TABLE IF NOT EXISTS public.hr_commission_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role TEXT, -- e.g. 'staff', 'technician'
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- specific user rule
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE, -- specific service
    commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed')),
    commission_value DECIMAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Payroll Slips (Phiếu lương)
CREATE TABLE IF NOT EXISTS public.hr_payroll_slips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    base_salary DECIMAL DEFAULT 0,
    total_commission DECIMAL DEFAULT 0,
    bonus DECIMAL DEFAULT 0,
    deductions DECIMAL DEFAULT 0,
    net_salary DECIMAL DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, month, year)
);

-- RLS Policies
ALTER TABLE public.hr_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_shift_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_slips ENABLE ROW LEVEL SECURITY;

-- Admins & Managers can do all. Staff can read shifts, read/insert/update own registrations and attendance, read own payrolls.
-- (Simplified for schema definition)
