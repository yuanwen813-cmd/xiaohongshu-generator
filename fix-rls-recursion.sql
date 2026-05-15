-- 修复 RLS 无限递归：用 SECURITY DEFINER 函数替代内联子查询

-- 1. 管理员检查函数（SECURITY DEFINER 绕过 RLS，不会递归）
CREATE OR REPLACE FUNCTION check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- 2. 删除旧的递归 admin 策略
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;

-- 3. 重新创建使用 check_is_admin() 的策略

-- profiles: 管理员可读所有
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (check_is_admin());

-- profiles: 管理员可更新任何人的 profile
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (check_is_admin());

-- orders: 管理员可读所有订单
CREATE POLICY "Admins can read all orders"
  ON orders FOR SELECT
  USING (check_is_admin());

-- orders: 管理员可更新订单
CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  USING (check_is_admin())
  WITH CHECK (check_is_admin());

-- 4. 修复触发器中的同样递归问题
CREATE OR REPLACE FUNCTION prevent_sensitive_field_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.is_vip IS DISTINCT FROM NEW.is_vip) OR
     (OLD.is_admin IS DISTINCT FROM NEW.is_admin) OR
     (OLD.vip_expires_at IS DISTINCT FROM NEW.vip_expires_at) THEN
    -- auth.uid() 为空 = Supabase 后台操作，放行
    -- 否则用 check_is_admin() 验证（不会递归）
    IF auth.uid() IS NOT NULL AND NOT check_is_admin() THEN
      RAISE EXCEPTION '无权修改 is_vip / is_admin / vip_expires_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
