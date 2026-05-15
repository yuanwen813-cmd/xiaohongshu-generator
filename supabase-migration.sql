-- ============================================
-- 小红书文案生成器 — Supabase 数据库迁移脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. profiles 表（用户信息，注册时由触发器自动创建）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  vip_expires_at TIMESTAMPTZ DEFAULT NULL,
  daily_count INT NOT NULL DEFAULT 0,
  last_date TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. orders 表（支付订单）
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'wechat',
  transaction_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ DEFAULT NULL
);

-- 3. 触发器：用户注册时自动创建 profile 行
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, last_date)
  VALUES (NEW.id, to_char(NOW(), 'YYYY-MM-DD'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- RLS 策略
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- --- profiles 表策略 ---

-- 所有人可读自己的 profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- 管理员可读所有 profile（用于管理后台）
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 用户可更新自己的 daily_count 和 last_date
CREATE POLICY "Users can update own counters"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 管理员可更新任何人的 profile（开通 VIP 等）
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- --- 触发器：防止非管理员修改 is_vip / is_admin / vip_expires_at ---
CREATE OR REPLACE FUNCTION prevent_sensitive_field_update()
RETURNS TRIGGER AS $$
BEGIN
  -- 检查敏感字段是否被修改
  IF (OLD.is_vip IS DISTINCT FROM NEW.is_vip) OR
     (OLD.is_admin IS DISTINCT FROM NEW.is_admin) OR
     (OLD.vip_expires_at IS DISTINCT FROM NEW.vip_expires_at) THEN
    -- 只允许管理员修改
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION '无权修改 is_vip / is_admin / vip_expires_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_sensitive_update ON profiles;
CREATE TRIGGER prevent_sensitive_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sensitive_field_update();

-- --- orders 表策略 ---

-- 用户可读自己的订单
CREATE POLICY "Users can read own orders"
  ON orders FOR SELECT
  USING (user_id = auth.uid());

-- 管理员可读所有订单
CREATE POLICY "Admins can read all orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 所有人可创建订单（包括未登录者通过 user_email 关联）
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- 管理员可更新订单状态
CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================
-- 初始化：设置你的管理员
-- ============================================
-- 用你的邮箱注册后，在 Supabase → Table Editor → profiles 表中
-- 将你那一行的 is_admin 改为 true
--
-- 或者在这里预先执行（把邮箱换成你的）：
-- UPDATE profiles SET is_admin = true
-- WHERE id IN (SELECT id FROM auth.users WHERE email = '你的邮箱@example.com');
