DO $$
BEGIN
  IF to_regclass('public.inventario') IS NULL THEN
    RAISE EXCEPTION 'No existe la tabla public.inventario; no se aplicaron cambios.';
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON public.inventario';
END
$$;

SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check,
  c.relrowsecurity AS rls_enabled
FROM pg_policies AS p
JOIN pg_class AS c ON c.relname = p.tablename
JOIN pg_namespace AS n ON n.oid = c.relnamespace AND n.nspname = p.schemaname
WHERE p.schemaname = 'public'
  AND p.tablename = 'inventario'
ORDER BY p.policyname;
