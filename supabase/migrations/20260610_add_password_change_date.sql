-- Thêm cột lưu vết ngày đổi mật khẩu gần nhất
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP WITH TIME ZONE;
