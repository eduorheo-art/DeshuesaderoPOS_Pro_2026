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

-- Columnas de negocio para Patio Compartido (FaceCar & Autopartes El Meyuca)
alter table yonke_parts add column if not exists negocio text;
alter table yonke_parts add column if not exists demanda text;
alter table yonke_parts add column if not exists busquedas_info text;
alter table yonke_vehicles add column if not exists negocio text;
alter table yonke_sales add column if not exists negocio text;
alter table yonke_sales add column if not exists vendedor_negocio text;

-- =========================================================================
-- TABLA DE PATIO COMPARTIDO (Alianza FaceCar y Autopartes El Meyuca)
-- Las cuentas independientes futuras que NO estén en esta tabla tendrán
-- aislamiento total y no podrán ver inventario de nadie más.
-- =========================================================================
create table if not exists yonke_shared_yard_members (
  id uuid primary key default gen_random_uuid(),
  yard_id text not null default 'patio_facecar_meyuca',
  owner_id uuid not null,
  business_name text not null, -- 'FaceCar' o 'Autopartes El Meyuca'
  created_at timestamptz not null default now(),
  unique (yard_id, owner_id)
);

alter table yonke_shared_yard_members enable row level security;
create policy yonke_shared_yard_members_read on yonke_shared_yard_members
  for select to authenticated
  using (true);

-- Función segura para verificar si dos cuentas son socias del mismo patio
create or replace function are_yard_partners(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from yonke_shared_yard_members m1
    join yonke_shared_yard_members m2 on m1.yard_id = m2.yard_id
    where m1.owner_id = user_a and m2.owner_id = user_b
  );
$$;

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

-- =========================================================================
-- POLÍTICAS RLS PARA PATIO COMPARTIDO Y AISLAMIENTO DE NEGOCIOS INDEPENDIENTES
-- =========================================================================

-- 1. PIEZAS (INVENTARIO):
-- Lectura compartida entre socios del patio (o solo dueño si es independiente)
create policy yonke_parts_shared_yard_select on yonke_parts
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or are_yard_partners(owner_id, (select auth.uid()))
  );

-- Actualización (descuento de inventario en venta cruzada de patio)
create policy yonke_parts_shared_yard_update on yonke_parts
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or are_yard_partners(owner_id, (select auth.uid()))
  )
  with check (
    owner_id = (select auth.uid())
    or are_yard_partners(owner_id, (select auth.uid()))
  );

-- Inserción y eliminación: solo el dueño de la cuenta
create policy yonke_parts_owner_insert on yonke_parts
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy yonke_parts_owner_delete on yonke_parts
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- 2. VEHÍCULOS DONADORES:
-- Lectura compartida entre socios del patio para consultar autos en patio
create policy yonke_vehicles_shared_yard_select on yonke_vehicles
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or are_yard_partners(owner_id, (select auth.uid()))
  );

create policy yonke_vehicles_owner_modify on yonke_vehicles
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 3. VENTAS (HISTORIAL Y FINANZAS) - 100% AISLADAS:
-- La lectura es ESTRICTAMENTE solo del dueño de la venta (el dinero no se comparte ni se ve)
create policy yonke_sales_owner_select on yonke_sales
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- La inserción permite registrar la venta a favor del socio en venta cruzada
create policy yonke_sales_insert_policy on yonke_sales
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    or are_yard_partners(owner_id, (select auth.uid()))
  );

create policy yonke_sales_owner_modify on yonke_sales
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy yonke_sales_owner_delete on yonke_sales
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- 4. GASTOS - 100% AISLADOS:
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
