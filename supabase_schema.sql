-- YonkePOS Pro - esquema Supabase alineado al Excel Inventario Mecanisto
-- Columnas Excel (A-K): MODELO, AÑO, PIEZA, FECHA DE VENTA, OBSERVACION,
-- ESTADO, PRECIO (BASE), PRECIO (MINIMO), CANTIDAD, VENTA FINAL, COMPATIBILIDAD (OTROS)
-- Precios se guardan como número (igual que Gemini/Claude): 12000, no "$ 12,000.00"

create table if not exists yonke_parts (
  id text primary key,
  vehiculo_origen text,
  anio text,
  pieza text,
  fecha_venta text,
  observacion text,
  estado text,
  precio_base numeric,
  precio_minimo numeric,
  cantidad integer,
  venta_final numeric,
  compatibilidad text,
  fotos jsonb default '[]'::jsonb,
  ubicacion_patio text,
  updated_at timestamptz not null default now(),
  dispositivo_origen text,
  owner_id uuid default auth.uid()
);

create table if not exists yonke_vehicles (
  id text primary key,
  modelo text,
  anio text,
  costo numeric,
  fecha_ingreso text,
  color text,
  vin text,
  fotos jsonb not null default '[]'::jsonb,
  notas text,
  updated_at timestamptz not null default now(),
  dispositivo_origen text,
  owner_id uuid default auth.uid()
);
alter table yonke_vehicles add column if not exists fotos jsonb not null default '[]'::jsonb;

create table if not exists yonke_sales (
  id text primary key,
  pieza_id text,
  pieza_nombre text,
  vehiculo_origen text,
  precio_base numeric,
  precio_minimo numeric,
  monto_cobrado numeric,
  caja_a numeric,
  caja_b numeric,
  fecha text,
  hora text,
  tipo text,
  notas text,
  estado text,
  updated_at timestamptz not null default now(),
  dispositivo_origen text,
  owner_id uuid default auth.uid()
);

create table if not exists yonke_expenses (
  id text primary key,
  fecha text,
  concepto text,
  categoria text,
  monto numeric,
  nota text,
  updated_at timestamptz not null default now(),
  dispositivo_origen text,
  owner_id uuid default auth.uid()
);

alter table yonke_parts add column if not exists owner_id uuid default auth.uid();
alter table yonke_vehicles add column if not exists owner_id uuid default auth.uid();
alter table yonke_sales add column if not exists owner_id uuid default auth.uid();
alter table yonke_expenses add column if not exists owner_id uuid default auth.uid();

-- Existing rows remain private until the owner claims them with their Auth user UUID.
-- Run once in Supabase SQL Editor after signup:
-- update yonke_parts set owner_id = 'OWNER_AUTH_UUID' where owner_id is null;
-- update yonke_vehicles set owner_id = 'OWNER_AUTH_UUID' where owner_id is null;
-- update yonke_sales set owner_id = 'OWNER_AUTH_UUID' where owner_id is null;
-- update yonke_expenses set owner_id = 'OWNER_AUTH_UUID' where owner_id is null;

-- Existing rows stay inaccessible until the owner claims them with their Auth user UUID.
-- Run these once in the Supabase SQL Editor after creating the owner's account:
update yonke_parts set owner_id = '4a3be740-74e7-4996-9fd1-ab2aeb446ec9' where owner_id is null;
update yonke_vehicles set owner_id = '4a3be740-74e7-4996-9fd1-ab2aeb446ec9' where owner_id is null;
update yonke_sales set owner_id = '4a3be740-74e7-4996-9fd1-ab2aeb446ec9' where owner_id is null;
update yonke_expenses set owner_id = '4a3be740-74e7-4996-9fd1-ab2aeb446ec9' where owner_id is null;

alter table yonke_parts enable row level security;
alter table yonke_vehicles enable row level security;
alter table yonke_sales enable row level security;
alter table yonke_expenses enable row level security;
alter table yonke_parts force row level security;
alter table yonke_vehicles force row level security;
alter table yonke_sales force row level security;
alter table yonke_expenses force row level security;

-- Remove every previous policy on these tables; permissive policies are OR-combined.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('yonke_parts', 'yonke_vehicles', 'yonke_sales', 'yonke_expenses')
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end
$$;

create policy yonke_parts_owner_only on yonke_parts
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy yonke_vehicles_owner_only on yonke_vehicles
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy yonke_sales_owner_only on yonke_sales
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy yonke_expenses_owner_only on yonke_expenses
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array['yonke_parts', 'yonke_vehicles', 'yonke_sales', 'yonke_expenses']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('yonke_parts', 'yonke_vehicles', 'yonke_sales', 'yonke_expenses')
order by tablename, policyname;
