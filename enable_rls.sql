-- Chạy đoạn mã này để BẬT LẠI bảo vệ dữ liệu trên TẤT CẢ các bảng hiện có
DO $$ 
DECLARE
    t_name text;
BEGIN
    FOR t_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;
