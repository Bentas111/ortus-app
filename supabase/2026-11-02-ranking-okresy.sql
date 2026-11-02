-- Ranking Ortusia: dzisiaj, ten tydzień, ten miesiąc, ogółem (2.11.2026)
-- Uruchomić raz w Supabase: SQL Editor → New query → wklej → Run.
-- Dzień i miesiąc liczy baza (czas polski), nie aplikacja: wyzwalacz bierze przyrost XP
-- przy każdym zapisie wiersza, więc działają stare i nowe wersje aplikacji.

alter table ortus_ranking add column if not exists day_xp    integer not null default 0 check (day_xp >= 0);
alter table ortus_ranking add column if not exists day_key   text    not null default '';
alter table ortus_ranking add column if not exists month_xp  integer not null default 0 check (month_xp >= 0);
alter table ortus_ranking add column if not exists month_key text    not null default '';
create index if not exists ortus_ranking_day   on ortus_ranking (day_key, day_xp desc);
create index if not exists ortus_ranking_month on ortus_ranking (month_key, month_xp desc);

create or replace function ortus_ranking_okresy() returns trigger
language plpgsql as $$
declare
  v_dzien   text := to_char(now() at time zone 'Europe/Warsaw', 'YYYY-MM-DD');
  v_miesiac text := to_char(now() at time zone 'Europe/Warsaw', 'YYYY-MM');
  v_delta   integer;
begin
  if tg_op = 'INSERT' then
    v_delta := greatest(coalesce(new.xp, 0), 0);
    new.day_xp := v_delta;  new.month_xp := v_delta;
  else
    v_delta := greatest(coalesce(new.xp, 0) - coalesce(old.xp, 0), 0);
    new.day_xp   := case when old.day_key   = v_dzien   then coalesce(old.day_xp, 0)   + v_delta else v_delta end;
    new.month_xp := case when old.month_key = v_miesiac then coalesce(old.month_xp, 0) + v_delta else v_delta end;
  end if;
  new.day_key := v_dzien;  new.month_key := v_miesiac;
  return new;
end $$;

drop trigger if exists ortus_ranking_okresy on ortus_ranking;
create trigger ortus_ranking_okresy before insert or update on ortus_ranking
  for each row execute function ortus_ranking_okresy();

-- widok publiczny (bez user_id) z nowymi kolumnami; nowe kolumny dopisane na końcu
create or replace view ortus_ranking_public with (security_invoker = false) as
  select nick, xp, badges, mastered, streak, week_xp, week_key, level, updated_at,
         day_xp, day_key, month_xp, month_key
  from ortus_ranking;
grant select on ortus_ranking_public to anon, authenticated;

-- kontrola
select nick, xp, day_xp, day_key, month_xp, month_key from ortus_ranking_public order by xp desc limit 5;
