-- Relatório grátis do plano free: 1 relatório em PDF por mês do calendário
-- (horas ou KM). Baixar de novo o mesmo relatório (mesmo tipo e período) não
-- conta outro. Usuários PRO não gravam aqui.
--
-- O unique (user_id, month) garante no banco o limite de 1 por mês, inclusive
-- entre aparelhos diferentes.

create table if not exists public.free_report_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1), -- 1º dia do mês
  report_type text not null check (report_type in ('hours', 'km')),
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, month)
);

alter table public.free_report_usage enable row level security;

drop policy if exists free_report_usage_select_own_or_admin on public.free_report_usage;
create policy free_report_usage_select_own_or_admin on public.free_report_usage
  for select using (((select auth.uid()) = user_id) or public.is_admin());

drop policy if exists free_report_usage_insert_own on public.free_report_usage;
create policy free_report_usage_insert_own on public.free_report_usage
  for insert with check ((select auth.uid()) = user_id);
