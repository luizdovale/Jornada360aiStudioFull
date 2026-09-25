-- Pagamento via Pix (avulso) ao lado da assinatura recorrente no cartão.
--
-- Regra de PRO depois desta migration:
--   status = 'active' e plan = 'pro' e
--   (payment_method is distinct from 'pix' or current_period_end > now())
-- Ou seja: cartão e PRO liberado manualmente (payment_method null) continuam
-- exatamente como antes; só o Pix tem vencimento.

alter table public.subscriptions
  add column if not exists payment_method text
  check (payment_method in ('card', 'pix'));

-- Uma linha por cobrança Pix gerada. É a fonte de verdade para não creditar o
-- mesmo pagamento duas vezes (webhook e sync podem chegar ao mesmo tempo).
create table if not exists public.pix_payments (
  mp_payment_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  amount numeric(10, 2) not null,
  status text not null default 'pending',
  credited_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists pix_payments_user_created_idx
  on public.pix_payments (user_id, created_at desc);

alter table public.pix_payments enable row level security;

-- Cliente só lê as próprias cobranças (para acompanhar o status na tela).
-- Escrita só pelas edge functions, com service_role.
drop policy if exists pix_payments_select_own_or_admin on public.pix_payments;
create policy pix_payments_select_own_or_admin on public.pix_payments
  for select using (((select auth.uid()) = user_id) or public.is_admin());

-- Credita um Pix aprovado: marca a cobrança como creditada (uma única vez) e
-- libera/estende o PRO. Se o usuário ainda tem PRO via Pix válido, soma o
-- período ao vencimento atual em vez de contar a partir de hoje.
create or replace function public.credit_pix_payment(p_payment_id text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_payment public.pix_payments%rowtype;
  v_period interval;
begin
  update public.pix_payments
     set status = 'approved',
         credited_at = now(),
         updated_at = now()
   where mp_payment_id = p_payment_id
     and credited_at is null
  returning * into v_payment;

  if not found then
    return false;
  end if;

  v_period := case v_payment.billing_interval
                when 'yearly' then interval '1 year'
                else interval '1 month'
              end;

  insert into public.subscriptions as s
    (user_id, plan, status, billing_interval, payment_method, current_period_end, updated_at)
  values
    (v_payment.user_id, 'pro', 'active', v_payment.billing_interval, 'pix', now() + v_period, now())
  on conflict (user_id) do update set
    plan = 'pro',
    status = 'active',
    billing_interval = excluded.billing_interval,
    payment_method = 'pix',
    current_period_end = case
      when s.payment_method = 'pix' and s.status = 'active' and s.current_period_end > now()
        then s.current_period_end + v_period
      else excluded.current_period_end
    end,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.credit_pix_payment(text) from public, anon, authenticated;
grant execute on function public.credit_pix_payment(text) to service_role;

-- Painel DEV: Pix vencido aparece como 'expired' (não conta como PRO).
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
      when s.status = 'active' and s.payment_method = 'pix'
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
