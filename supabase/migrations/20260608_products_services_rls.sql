-- ============================================================
-- PRODUCTS & SERVICES MODULE RLS MIGRATION
-- Date: 2026-06-08
-- ============================================================

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_treatment_courses ENABLE ROW LEVEL SECURITY;

-- Disable RLS for testing (since auth might be mocked)
-- or Create public policies
CREATE POLICY "Public profiles are viewable by everyone." ON product_categories FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON product_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON product_categories FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON product_categories FOR DELETE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON brands FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON brands FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON brands FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON brands FOR DELETE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON products FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON products FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON products FOR DELETE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON product_variants FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON product_variants FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON product_variants FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON product_variants FOR DELETE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON inventory_transactions FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON inventory_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON inventory_transactions FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON inventory_transactions FOR DELETE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON service_categories FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON service_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON service_categories FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON service_categories FOR DELETE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON services FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON services FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON services FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON services FOR DELETE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON service_combos FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON service_combos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON service_combos FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON service_combos FOR DELETE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON treatment_courses FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON treatment_courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON treatment_courses FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON treatment_courses FOR DELETE USING (true);

CREATE POLICY "Public profiles are viewable by everyone." ON customer_treatment_courses FOR SELECT USING (true);
CREATE POLICY "Public profiles are insertable by everyone." ON customer_treatment_courses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles are updatable by everyone." ON customer_treatment_courses FOR UPDATE USING (true);
CREATE POLICY "Public profiles are deletable by everyone." ON customer_treatment_courses FOR DELETE USING (true);
