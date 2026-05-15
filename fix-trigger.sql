-- 修复注册触发器，替换之前的 handle_new_user 函数
-- 在 Supabase SQL Editor 中执行

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, last_date, daily_count, is_vip, is_admin)
  VALUES (NEW.id, to_char(now(), 'YYYY-MM-DD'), 0, false, false);
  RETURN NEW;
END;
$$;
