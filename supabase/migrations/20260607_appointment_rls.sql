-- ============================================================
-- RLS POLICIES FOR APPOINTMENT MODULE
-- Chạy file này sau khi đã chạy migration chính
-- ============================================================

-- ─── STAFF TABLE ─────────────────────────────────────────────
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON staff
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── ROOMS TABLE ─────────────────────────────────────────────
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON rooms
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── APPOINTMENTS TABLE ──────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON appointments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── APPOINTMENT LOGS TABLE ──────────────────────────────────
ALTER TABLE appointment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON appointment_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── REMINDER SETTINGS TABLE ─────────────────────────────────
ALTER TABLE appointment_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON appointment_reminder_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
