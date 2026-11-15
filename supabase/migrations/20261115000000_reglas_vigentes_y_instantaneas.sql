-- Reglas con vigencia e instantáneas de cálculo (solo se agrega, nunca se edita ni se borra).
-- Reversión: supabase/rollback/20261115000000_reglas_vigentes_y_instantaneas.down.sql

create table if not exists public.finance_rule_versions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_key    text not null check (rule_key ~ '^[a-z]+(\.[a-z_]+)+$'),
  subject_id  text not null default '*',              -- id del producto o '*' para la regla general
  value       jsonb not null,
  valid_from  date not null,                          -- inicio de vigencia; el fin es el inicio de la siguiente
  created_at  timestamptz not null default now(),
  unique (user_id, rule_key, subject_id, valid_from, created_at)
);
create index if not exists finance_rule_versions_lookup
  on public.finance_rule_versions (user_id, rule_key, subject_id, valid_from desc);

create table if not exists public.finance_record_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  record_type text not null check (record_type in ('cuenta','tarjeta','certificado','prestamo','pago','cargo','interes')),
  record_id   text not null,
  as_of       date not null,                          -- fecha en que se creó o calculó el registro
  rules       jsonb not null,                         -- copia de las reglas vigentes en ese momento
  results     jsonb not null,                         -- resultados calculados en ese momento
  created_at  timestamptz not null default now(),
  unique (user_id, record_type, record_id, as_of)
);
create index if not exists finance_record_snapshots_lookup
  on public.finance_record_snapshots (user_id, record_type, record_id, as_of desc);

-- Solo se agrega: ninguna actualización ni borrado, ni siquiera del propietario.
create or replace function public.finance_block_history_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'El historial financiero no se modifica ni se borra (%).', tg_table_name using errcode = 'P0001';
end $$;

drop trigger if exists finance_rule_versions_append_only on public.finance_rule_versions;
create trigger finance_rule_versions_append_only
  before update or delete on public.finance_rule_versions
  for each row execute function public.finance_block_history_changes();

drop trigger if exists finance_record_snapshots_append_only on public.finance_record_snapshots;
create trigger finance_record_snapshots_append_only
  before update or delete on public.finance_record_snapshots
  for each row execute function public.finance_block_history_changes();

-- Una nueva vigencia debe empezar después de la última del mismo sujeto.
create or replace function public.finance_check_rule_start() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.finance_rule_versions v
             where v.user_id = new.user_id and v.rule_key = new.rule_key
               and v.subject_id = new.subject_id and v.valid_from > new.valid_from) then
    raise exception 'La nueva vigencia debe empezar después de la última registrada.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists finance_rule_versions_check_start on public.finance_rule_versions;
create trigger finance_rule_versions_check_start
  before insert on public.finance_rule_versions
  for each row execute function public.finance_check_rule_start();

alter table public.finance_rule_versions   enable row level security;
alter table public.finance_record_snapshots enable row level security;

create policy finance_rule_versions_select on public.finance_rule_versions
  for select to authenticated using (user_id = (select auth.uid()));
create policy finance_rule_versions_insert on public.finance_rule_versions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy finance_record_snapshots_select on public.finance_record_snapshots
  for select to authenticated using (user_id = (select auth.uid()));
create policy finance_record_snapshots_insert on public.finance_record_snapshots
  for insert to authenticated with check (user_id = (select auth.uid()));

revoke all on public.finance_rule_versions, public.finance_record_snapshots from anon, public;
grant select, insert on public.finance_rule_versions, public.finance_record_snapshots to authenticated;
