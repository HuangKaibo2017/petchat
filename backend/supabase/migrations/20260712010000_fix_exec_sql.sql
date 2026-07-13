CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  r record;
  is_select boolean;
BEGIN
  is_select := (lower(trim(sql)) LIKE 'select%' OR lower(trim(sql)) LIKE 'with%');

  IF is_select THEN
    FOR r IN EXECUTE sql LOOP
      RETURN NEXT to_json(r);
    END LOOP;
  ELSE
    EXECUTE sql;
  END IF;

  RETURN;
END;
$$;
