CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY EXECUTE sql;
END;
$$;

COMMENT ON FUNCTION public.exec_sql IS '执行任意 SQL 查询，返回 JSON 行集。仅限 service_role 调用。';
