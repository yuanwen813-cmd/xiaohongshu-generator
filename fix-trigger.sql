-- 修复触发器：允许 Supabase 后台 (auth.uid() IS NULL) 操作
CREATE OR REPLACE FUNCTION prevent_sensitive_field_update()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.is_vip IS DISTINCT FROM NEW.is_vip) OR
     (OLD.is_admin IS DISTINCT FROM NEW.is_admin) OR
     (OLD.vip_expires_at IS DISTINCT FROM NEW.vip_expires_at) THEN
    -- auth.uid() 为空 = Supabase 后台/服务端操作，放行
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    ) THEN
      RAISE EXCEPTION '无权修改 is_vip / is_admin / vip_expires_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
