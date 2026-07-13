CREATE OR REPLACE FUNCTION public.exec_ddl(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

ALTER TABLE t_user ADD COLUMN IF NOT EXISTS f_wx_openid VARCHAR(64);
ALTER TABLE t_user ADD COLUMN IF NOT EXISTS f_wx_unionid VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_t_user_wx_openid ON t_user(f_wx_openid)
  WHERE f_wx_openid IS NOT NULL AND f_wx_openid <> '';

ALTER TABLE t_user ADD COLUMN IF NOT EXISTS f_deleted SMALLINT DEFAULT 0;
