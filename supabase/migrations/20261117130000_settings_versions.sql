-- Histórico das configurações que afetam cálculos e períodos.
--
-- Cada versão vale a partir de effective_from até a véspera da próxima. Os
-- cálculos de um dia usam a versão vigente naquela data, então mudar as
-- configurações não altera o que já passou. A tabela settings continua
-- existindo (km_enabled e fallback); os campos abaixo passam a vir daqui.
--
-- A versão inicial de cada usuário usa effective_from = 1900-01-01 e vale
-- para todo o passado.

create table if not exists public.settings_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  jornada_base smallint not null,
  month_start_day smallint not null check (month_start_day between 1 and 31),
  escala_pattern varchar not null,
  escala_start_date date,
  company_name text check (char_length(company_name) <= 80),
  trip_label text check (char_length(trip_label) <= 20),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, effective_from)
);

alter table public.settings_versions enable row level security;

drop policy if exists settings_versions_select_own_or_admin on public.settings_versions;
create policy settings_versions_select_own_or_admin on public.settings_versions
  for select using (((select auth.uid()) = user_id) or public.is_admin());

drop policy if exists settings_versions_insert_own on public.settings_versions;
create policy settings_versions_insert_own on public.settings_versions
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists settings_versions_update_own on public.settings_versions;
create policy settings_versions_update_own on public.settings_versions
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A versão inicial não pode ser apagada: sem ela o passado ficaria sem regra.
drop policy if exists settings_versions_delete_own on public.settings_versions;
create policy settings_versions_delete_own on public.settings_versions
  for delete using ((select auth.uid()) = user_id and effective_from > date '1900-01-01');

-- Nome do registro de viagem ("RV", "Shift"...). Vazio = "RV".
alter table public.settings
  add column if not exists trip_label text check (char_length(trip_label) <= 20);

-- Versão inicial = configuração atual de cada usuário.
insert into public.settings_versions
  (user_id, effective_from, jornada_base, month_start_day, escala_pattern, escala_start_date, company_name, trip_label)
select user_id, date '1900-01-01', jornada_base, month_start_day, escala_pattern, escala_start_date, company_name, trip_label
from public.settings
on conflict (user_id, effective_from) do nothing;
