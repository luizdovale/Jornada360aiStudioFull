-- Visualização grátis do calendário no plano free: 1 crédito por mês do
-- calendário libera a escala completa de 1 mês à escolha. Esse mês pode ser
-- visto quantas vezes quiser até o fim do mês em que o crédito foi usado.
-- A semana atual continua grátis. Usuários PRO não gravam aqui.
--
-- O unique (user_id, month) garante no banco o limite de 1 por mês, inclusive
-- entre aparelhos diferentes.

create table if not exists public.free_calendar_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),        -- mês em que o crédito foi usado
  viewed_month date not null check (extract(day from viewed_month) = 1), -- mês liberado
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, month)
);

alter table public.free_calendar_usage enable row level security;

drop policy if exists free_calendar_usage_select_own_or_admin on public.free_calendar_usage;
create policy free_calendar_usage_select_own_or_admin on public.free_calendar_usage
  for select using (((select auth.uid()) = user_id) or public.is_admin());

drop policy if exists free_calendar_usage_insert_own on public.free_calendar_usage;
create policy free_calendar_usage_insert_own on public.free_calendar_usage
  for insert with check ((select auth.uid()) = user_id);
