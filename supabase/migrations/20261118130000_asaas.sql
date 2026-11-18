-- Cobrança pelo Asaas (assinatura recorrente no Pix ou no cartão).
--
-- Assinaturas que já existem continuam no Mercado Pago (provider default) e
-- seguem exatamente as regras de antes. Regra de PRO depois desta migration:
--   status = 'active' e plan = 'pro' e
--   asaas:              current_period_end + 3 dias de tolerância > now()
--   mercadopago + pix:  current_period_end > now()
--   mercadopago cartão / liberado manualmente: sem vencimento

alter table public.subscriptions
  add column if not exists provider text not null default 'mercadopago'
    check (provider in ('mercadopago', 'asaas')),
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists canceled_at timestamptz;

create unique index if not exists subscriptions_asaas_customer_id_key
  on public.subscriptions (asaas_customer_id)
  where asaas_customer_id is not null;

create index if not exists subscriptions_asaas_subscription_id_idx
  on public.subscriptions (asaas_subscription_id)
  where asaas_subscription_id is not null;

-- Uma linha por cobrança do Asaas que chegou até nós (webhook ou sync).
create table if not exists public.asaas_payments (
  asaas_payment_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  asaas_subscription_id text,
  billing_interval text check (billing_interval in ('monthly', 'yearly')),
  billing_type text,
  value numeric(10, 2),
  status text not null,
  due_date date,
  credited_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists asaas_payments_user_created_idx
  on public.asaas_payments (user_id, created_at desc);

alter table public.asaas_payments enable row level security;

drop policy if exists asaas_payments_select_own_or_admin on public.asaas_payments;
create policy asaas_payments_select_own_or_admin on public.asaas_payments
  for select using (((select auth.uid()) = user_id) or public.is_admin());

-- Credita uma cobrança paga: registra (uma única vez) e libera o PRO até o fim
-- do dia do próximo vencimento (vencimento desta cobrança + 1 mês/1 ano, no
-- horário de Brasília). Nunca encurta um período já pago: quem ainda tinha
-- dias (ex.: Pix do Mercado Pago) só é cobrado no fim deles.
-- Retorna o novo current_period_end, ou null se a cobrança já tinha sido creditada.
create or replace function public.credit_asaas_payment(
  p_payment_id text,
  p_user_id uuid,
  p_subscription_id text,
  p_interval text,
  p_billing_type text,
  p_value numeric,
  p_due_date date
)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_period interval;
  v_end timestamptz;
  v_credited int;
begin
  if p_interval not in ('monthly', 'yearly') then
    raise exception 'invalid interval %', p_interval;
  end if;

  insert into public.asaas_payments
    (asaas_payment_id, user_id, asaas_subscription_id, billing_interval, billing_type, value, status, due_date)
  values
    (p_payment_id, p_user_id, p_subscription_id, p_interval, p_billing_type, p_value, 'credited', p_due_date)
  on conflict (asaas_payment_id) do nothing;

  update public.asaas_payments
     set status = 'credited',
         credited_at = now(),
         updated_at = now(),
         billing_interval = p_interval,
         billing_type = p_billing_type,
         value = p_value,
         due_date = p_due_date
   where asaas_payment_id = p_payment_id
     and credited_at is null;
  get diagnostics v_credited = row_count;

  if v_credited = 0 then
    return null;
  end if;

  v_period := case p_interval when 'yearly' then interval '1 year' else interval '1 month' end;
  -- Fim do dia do próximo vencimento, em Brasília.
  v_end := ((p_due_date + v_period)::date + 1)::timestamp at time zone 'America/Sao_Paulo';

  update public.subscriptions
     set plan = 'pro',
         status = 'active',
         provider = 'asaas',
         billing_interval = p_interval,
         payment_method = case p_billing_type when 'PIX' then 'pix' else 'card' end,
         current_period_end = greatest(coalesce(current_period_end, v_end), v_end),
         updated_at = now()
   where user_id = p_user_id
  returning current_period_end into v_end;

  return v_end;
end;
$$;

revoke all on function public.credit_asaas_payment(text, uuid, text, text, text, numeric, date) from public, anon, authenticated;
grant execute on function public.credit_asaas_payment(text, uuid, text, text, text, numeric, date) to service_role;

-- Painel DEV: PRO com período vencido aparece como 'expired'.
create or replace function public.admin_list_users()
returns table(id uuid, email text, role text, created_at timestamp with time zone, journeys_count bigint, last_journey_date date, plan text, status text, avatar_url text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select p.id, p.email, p.role, p.created_at,
    coalesce(j.cnt, 0) as journeys_count,
    j.last_date as last_journey_date,
    s.plan,
    case
      when s.status = 'active' and s.provider = 'asaas'
           and (s.current_period_end is null or s.current_period_end + interval '3 days' <= now())
        then 'expired'
      when s.status = 'active' and s.provider = 'mercadopago' and s.payment_method = 'pix'
           and (s.current_period_end is null or s.current_period_end <= now())
        then 'expired'
      else s.status
    end as status,
    u.raw_user_meta_data->>'avatar_url' as avatar_url
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join (
    select user_id, count(*) as cnt, max(date) as last_date
    from public.journeys group by user_id
  ) j on j.user_id = p.id
  left join public.subscriptions s on s.user_id = p.id
  order by p.created_at desc;
end;
$function$;

-- Configuração do webhook do Asaas, feita pelo painel DEV (asaas-subscription,
-- ação setup_webhook). Guarda o token que o Asaas envia em cada evento.
-- Sem policies: só o service_role (edge functions) lê e escreve.
-- previous_webhook_token cobre a troca de token, enquanto eventos assinados
-- com o anterior ainda chegam.
create table if not exists public.asaas_config (
  id smallint primary key default 1 check (id = 1),
  environment text check (environment in ('sandbox', 'production')),
  webhook_id text,
  webhook_token text,
  previous_webhook_token text,
  configured_at timestamptz,
  configured_by uuid references auth.users (id) on delete set null
);

alter table public.asaas_config enable row level security;
revoke all on public.asaas_config from anon, authenticated;
