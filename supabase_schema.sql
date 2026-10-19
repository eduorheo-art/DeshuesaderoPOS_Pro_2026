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
  dispositivo_origen text
);

create table if not exists yonke_vehicles (
  id text primary key,
  modelo text,
  anio text,
  costo numeric,
  fecha_ingreso text,
  color text,
  vin text,
  notas text,
  updated_at timestamptz not null default now(),
  dispositivo_origen text
);

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
  dispositivo_origen text
);

create table if not exists yonke_expenses (
  id text primary key,
  fecha text,
  concepto text,
  categoria text,
  monto numeric,
  nota text,
  updated_at timestamptz not null default now(),
  dispositivo_origen text
);

alter table yonke_parts enable row level security;
alter table yonke_vehicles enable row level security;
alter table yonke_sales enable row level security;
alter table yonke_expenses enable row level security;

drop policy if exists yonke_parts_all on yonke_parts;
drop policy if exists yonke_vehicles_all on yonke_vehicles;
drop policy if exists yonke_sales_all on yonke_sales;
drop policy if exists yonke_expenses_all on yonke_expenses;

create policy yonke_parts_all on yonke_parts for all using (true) with check (true);
create policy yonke_vehicles_all on yonke_vehicles for all using (true) with check (true);
create policy yonke_sales_all on yonke_sales for all using (true) with check (true);
create policy yonke_expenses_all on yonke_expenses for all using (true) with check (true);

alter publication supabase_realtime add table yonke_parts;
alter publication supabase_realtime add table yonke_vehicles;
alter publication supabase_realtime add table yonke_sales;
alter publication supabase_realtime add table yonke_expenses;
