-- Compatibilidade com o app antigo (anterior ao histórico de configurações).
--
-- O app antigo grava jornada, dia contábil, escala, empresa e registro só na
-- tabela settings; o app novo lê esses campos de settings_versions. Para a
-- mudança não "sumir", quando settings muda e o usuário ainda não tem
-- alterações com data (só a versão inicial), a versão inicial acompanha —
-- que é exatamente o comportamento de antes do histórico.
--
-- Quem já tem histórico (alguma versão depois de 1900-01-01) não é tocado.
-- O app novo grava a versão antes de settings, então também não é afetado.

create or replace function public.sync_settings_baseline_version()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from public.settings_versions
    where user_id = new.user_id and effective_from > date '1900-01-01'
  ) then
    return new;
  end if;

  insert into public.settings_versions as v
    (user_id, effective_from, jornada_base, month_start_day, escala_pattern, escala_start_date, company_name, trip_label)
  values
    (new.user_id, date '1900-01-01', new.jornada_base, new.month_start_day, new.escala_pattern, new.escala_start_date, new.company_name, new.trip_label)
  on conflict (user_id, effective_from) do update set
    jornada_base = excluded.jornada_base,
    month_start_day = excluded.month_start_day,
    escala_pattern = excluded.escala_pattern,
    escala_start_date = excluded.escala_start_date,
    company_name = excluded.company_name,
    trip_label = excluded.trip_label
  where (v.jornada_base, v.month_start_day, v.escala_pattern, v.escala_start_date, v.company_name, v.trip_label)
    is distinct from
        (excluded.jornada_base, excluded.month_start_day, excluded.escala_pattern, excluded.escala_start_date, excluded.company_name, excluded.trip_label);

  return new;
end;
$$;

revoke all on function public.sync_settings_baseline_version() from public, anon, authenticated;

drop trigger if exists settings_sync_baseline_version on public.settings;
create trigger settings_sync_baseline_version
  after insert or update on public.settings
  for each row execute function public.sync_settings_baseline_version();
