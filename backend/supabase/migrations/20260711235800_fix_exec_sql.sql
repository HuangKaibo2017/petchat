DROP FUNCTION IF EXISTS public.exec_sql(text);
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE r record;
BEGIN
  FOR r IN EXECUTE sql LOOP
    RETURN NEXT to_json(r);
  END LOOP;
  RETURN;
END;
$$;
