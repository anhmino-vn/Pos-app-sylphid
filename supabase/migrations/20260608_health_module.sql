-- ============================================================
-- HEALTH & TREATMENT MODULE MIGRATION
-- Date: 2026-06-08
-- Tables: health_records, treatment_plans, therapy_logs, health_evaluations
-- ============================================================

-- ─── HEALTH RECORDS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_records (
  id                  TEXT PRIMARY KEY DEFAULT ('HR-' || upper(substring(gen_random_uuid()::text, 1, 6))),
  code                TEXT UNIQUE,
  customer_id         TEXT,
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT,
  customer_email      TEXT,
  customer_address    TEXT,
  date_of_birth       TEXT,
  gender              TEXT,
  height              NUMERIC,
  weight              NUMERIC,
  bmi                 NUMERIC,
  blood_pressure      TEXT,
  heart_rate          NUMERIC,
  blood_sugar         NUMERIC,
  allergies           TEXT,
  conditions          JSONB DEFAULT '[]',
  current_medications TEXT,
  treatment_history   TEXT,
  current_condition   TEXT,
  profile_images      JSONB DEFAULT '[]',
  attachments         JSONB DEFAULT '[]',
  in_charge_staff     TEXT,
  in_charge_staff_name TEXT,
  status              TEXT DEFAULT 'active',
  note                TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── TREATMENT PLANS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS treatment_plans (
  id                  TEXT PRIMARY KEY DEFAULT ('TP-' || upper(substring(gen_random_uuid()::text, 1, 6))),
  code                TEXT UNIQUE,
  customer_id         TEXT,
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT,
  service_id          TEXT,
  service_name        TEXT,
  total_sessions      INTEGER DEFAULT 10,
  completed_sessions  INTEGER DEFAULT 0,
  remaining_sessions  INTEGER,
  price               NUMERIC,
  start_date          TEXT,
  end_date            TEXT,
  technician_id       TEXT,
  technician_name     TEXT,
  treatment_goal      TEXT,
  note                TEXT,
  sessions            JSONB DEFAULT '[]',
  status              TEXT DEFAULT 'active',
  health_record_id    TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── THERAPY LOGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS therapy_logs (
  id                  TEXT PRIMARY KEY DEFAULT ('TL-' || upper(substring(gen_random_uuid()::text, 1, 6))),
  treatment_plan_id   TEXT,
  customer_id         TEXT,
  customer_name       TEXT NOT NULL,
  session_number      INTEGER,
  date                TEXT,
  symptoms_before     TEXT,
  vital_signs_before  TEXT,
  images_before       JSONB DEFAULT '[]',
  services_performed  TEXT,
  duration            INTEGER,
  notes_during        TEXT,
  results             TEXT,
  evaluation          TEXT,
  images_after        JSONB DEFAULT '[]',
  customer_signature  TEXT,
  staff_signature     TEXT,
  technician_id       TEXT,
  technician_name     TEXT,
  status              TEXT DEFAULT 'completed',
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── HEALTH EVALUATIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_evaluations (
  id                      TEXT PRIMARY KEY DEFAULT ('HE-' || upper(substring(gen_random_uuid()::text, 1, 6))),
  customer_id             TEXT,
  customer_name           TEXT NOT NULL,
  treatment_plan_id       TEXT,
  treatment_plan_name     TEXT,
  weight_before           NUMERIC,
  weight_after            NUMERIC,
  blood_pressure_before   TEXT,
  blood_pressure_after    TEXT,
  blood_sugar_before      NUMERIC,
  blood_sugar_after       NUMERIC,
  images_before           JSONB DEFAULT '[]',
  images_after            JSONB DEFAULT '[]',
  improvement_rate        NUMERIC,
  professional_assessment TEXT,
  customer_rating         INTEGER,
  customer_feedback       TEXT,
  evaluated_by            TEXT,
  evaluated_at            TIMESTAMPTZ,
  created_by              TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Add simple RLS policies to allow authenticated users to read/write
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read health_records" ON health_records FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert health_records" ON health_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update health_records" ON health_records FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete health_records" ON health_records FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read treatment_plans" ON treatment_plans FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert treatment_plans" ON treatment_plans FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update treatment_plans" ON treatment_plans FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete treatment_plans" ON treatment_plans FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read therapy_logs" ON therapy_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert therapy_logs" ON therapy_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update therapy_logs" ON therapy_logs FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete therapy_logs" ON therapy_logs FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated read health_evaluations" ON health_evaluations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated insert health_evaluations" ON health_evaluations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update health_evaluations" ON health_evaluations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete health_evaluations" ON health_evaluations FOR DELETE USING (auth.role() = 'authenticated');
