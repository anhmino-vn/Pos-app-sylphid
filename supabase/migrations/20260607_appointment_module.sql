-- ============================================================
-- APPOINTMENT MODULE MIGRATION
-- Date: 2026-06-07
-- Tables: staff, rooms, appointments, appointment_logs
-- ============================================================

-- ─── STAFF ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id            TEXT PRIMARY KEY DEFAULT ('ST-' || upper(substring(gen_random_uuid()::text, 1, 6))),
  name          TEXT NOT NULL,
  code          TEXT UNIQUE,
  phone         TEXT,
  email         TEXT,
  position      TEXT,
  color         TEXT DEFAULT '#0D9488',
  avatar_url    TEXT,
  service_ids   TEXT[] DEFAULT '{}',
  branch_id     TEXT,
  branch_name   TEXT,
  working_hours JSONB DEFAULT '{}',
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── ROOMS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id          TEXT PRIMARY KEY DEFAULT ('RM-' || upper(substring(gen_random_uuid()::text, 1, 6))),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE,
  description TEXT,
  color       TEXT DEFAULT '#0891B2',
  capacity    INTEGER DEFAULT 1,
  floor       TEXT,
  branch_id   TEXT,
  branch_name TEXT,
  service_ids TEXT[] DEFAULT '{}',
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── APPOINTMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id              TEXT PRIMARY KEY DEFAULT ('AP-' || upper(substring(gen_random_uuid()::text, 1, 6))),
  customer_id     TEXT,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT,
  service_id      TEXT,
  service_name    TEXT,
  combo_id        TEXT,
  combo_name      TEXT,
  treatment_id    TEXT,
  treatment_name  TEXT,
  staff_id        TEXT,
  staff_name      TEXT,
  room_id         TEXT,
  room_name       TEXT,
  branch_id       TEXT,
  branch_name     TEXT,
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  duration        INTEGER,
  note            TEXT,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','in_progress','completed','no_show','cancelled','rescheduled')),
  cancel_reason   TEXT,
  checkin_at      TIMESTAMPTZ,
  checkin_by      TEXT,
  checkin_by_name TEXT,
  checkout_at     TIMESTAMPTZ,
  checkout_by     TEXT,
  checkout_by_name TEXT,
  created_by      TEXT,
  creator_name    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- ─── APPOINTMENT LOGS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointment_logs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  appointment_id  TEXT NOT NULL,
  action          TEXT NOT NULL,
  old_values      JSONB,
  new_values      JSONB,
  changed_by      TEXT,
  changed_by_name TEXT,
  changed_at      TIMESTAMPTZ DEFAULT now(),
  device_info     TEXT,
  ip_address      TEXT
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_date       ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id   ON appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_room_id    ON appointments(room_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status     ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointment_logs_appt   ON appointment_logs(appointment_id);

-- ─── REMINDER SETTINGS (stored in localStorage + this config) ──
CREATE TABLE IF NOT EXISTS appointment_reminder_settings (
  id           TEXT PRIMARY KEY DEFAULT 'default',
  before_hours INTEGER[] DEFAULT '{24, 12, 1}',
  channels     TEXT[] DEFAULT '{email}',
  is_active    BOOLEAN DEFAULT true,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

INSERT INTO appointment_reminder_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
