// ====== KONFIGURACJA SUPABASE ======
// Projekt: Zabawy Slowne (wspólne konta dla wszystkich gier NieKazMuLiczyc)
window.ORTUS_SUPABASE = {
  url: "https://ngaifkbatovxhysbprmn.supabase.co",
  anonKey: "sb_publishable_JVmsfE1qCEy49cIVxaXUYw_kdP-Yb9d"
};

// ====== REKLAMY ======
// UWAGA: bez wypełnionego "slot" AdSense nie wyświetli żadnej reklamy,
// a aplikacja świadomie ukrywa wtedy całą sekcję (zamiast pokazywać pustą ramkę).
// Identyfikator jednostki reklamowej znajdziesz w panelu AdSense → Reklamy → Według jednostek.
window.ORTUS_ADS = {
  client: "ca-pub-1505849560454642",
  slot: ""            // <- wklej tutaj numer jednostki, np. "1234567890"
};

// ====== FUNKCJE ======
// ranking: "off"  — przycisk Ranking znika (bezpieczne, dopóki wynik nie jest liczony po stronie serwera)
//          "week" — tylko tablica tygodniowa (zeruje się co poniedziałek; zawyżony wynik nie zostaje na stałe)
//          "all"  — pełny ranking; włącz dopiero po uruchomieniu funkcji ortus_submit_score (SQL niżej)
window.ORTUS_FEATURES = {
  ranking: "week"
};

// ============================================================
//  CO TRZEBA JEDNORAZOWO URUCHOMIĆ W PANELU SUPABASE
//  SQL Editor → New query → wklej całość poniżej → Run
// ============================================================
//
// -- 1) POSTĘPY GRACZA ---------------------------------------------------
// create table if not exists ortus_progress (
//   user_id    uuid primary key references auth.users(id) on delete cascade,
//   data       jsonb not null default '{}'::jsonb,
//   updated_at timestamptz not null default now()
// );
// alter table ortus_progress enable row level security;
// drop policy if exists "postep - odczyt"  on ortus_progress;
// drop policy if exists "postep - zapis"   on ortus_progress;
// drop policy if exists "postep - zmiana"  on ortus_progress;
// create policy "postep - odczyt" on ortus_progress for select using (auth.uid() = user_id);
// create policy "postep - zapis"  on ortus_progress for insert with check (auth.uid() = user_id);
// create policy "postep - zmiana" on ortus_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
//
// -- 2) RANKING ----------------------------------------------------------
// -- Tej tabeli brakowało w poprzedniej wersji instrukcji, choć aplikacja z niej korzysta.
// create table if not exists ortus_ranking (
//   user_id    uuid primary key references auth.users(id) on delete cascade,
//   nick       text not null check (char_length(nick) between 3 and 20),
//   xp         integer not null default 0 check (xp >= 0),
//   badges     integer not null default 0 check (badges >= 0),
//   mastered   integer not null default 0 check (mastered >= 0),
//   streak     integer not null default 0 check (streak >= 0),
//   week_xp    integer not null default 0 check (week_xp >= 0),
//   week_key   text    not null default '',
//   level      text    not null default '1-2' check (level in ('1-2','3-4','5-6')),
//   updated_at timestamptz not null default now()
// );
// create index if not exists ortus_ranking_week on ortus_ranking (week_key, week_xp desc);
// create index if not exists ortus_ranking_xp   on ortus_ranking (xp desc);
// alter table ortus_ranking enable row level security;
// drop policy if exists "ranking - odczyt publiczny" on ortus_ranking;
// drop policy if exists "ranking - wlasny zapis"     on ortus_ranking;
// drop policy if exists "ranking - wlasna zmiana"    on ortus_ranking;
// create policy "ranking - odczyt publiczny" on ortus_ranking for select using (true);
// create policy "ranking - wlasny zapis"  on ortus_ranking for insert with check (auth.uid() = user_id);
// create policy "ranking - wlasna zmiana" on ortus_ranking for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
// drop policy if exists "ranking - wlasne usuniecie" on ortus_ranking;
// create policy "ranking - wlasne usuniecie" on ortus_ranking for delete using (auth.uid() = user_id);
// -- unikalny pseudonim jest OBOWIĄZKOWY: aplikacja rozpoznaje własny wiersz w rankingu po pseudonimie
// create unique index if not exists ortus_ranking_nick_unique on ortus_ranking (lower(nick));
//
// -- 3b) WYNIK LICZONY PO STRONIE SERWERA ---------------------------------
// -- Klient nie może już wpisać sobie dowolnej liczby: funkcja przyjmuje zgłoszenie,
// -- ale sama ogranicza przyrost (max 300 XP na zgłoszenie, max 40 zgłoszeń na godzinę,
// -- każda lekcja liczona raz, zgłoszenie BEZ identyfikatora lekcji nie dodaje XP).
// -- Pozostałe liczby dostają wiarygodne granice: passa nie dłuższa niż wiek konta,
// -- słówka nie więcej niż XP/30 (opanowanie słowa = 3 poprawne odpowiedzi po 10 XP),
// -- odznaki nie więcej niż jest ich w grze. Pseudonim przechodzi tę samą moderację
// -- co w aplikacji — zapis z konsoli jej nie ominie.
// -- Aplikacja wywołuje funkcję automatycznie, gdy istnieje; gdy jej nie ma, wraca do
// -- zwykłego zapisu (dlatego zalecany tryb "week" do czasu wdrożenia).
// create table if not exists ortus_lessons (
//   lesson_id  text primary key,
//   user_id    uuid not null references auth.users(id) on delete cascade,
//   xp_delta   integer not null check (xp_delta between 0 and 300),
//   created_at timestamptz not null default now()
// );
// create index if not exists ortus_lessons_user_time on ortus_lessons (user_id, created_at desc);
// alter table ortus_lessons enable row level security;
// drop policy if exists "lekcje - wlasny odczyt" on ortus_lessons;
// create policy "lekcje - wlasny odczyt" on ortus_lessons for select using (auth.uid() = user_id);
//
// -- moderacja pseudonimu po stronie bazy (ta sama lista co nickProblem() w aplikacji)
// create or replace function ortus_nick_ok(p_nick text) returns boolean
// language sql immutable as $$
//   select p_nick is not null
//     and char_length(p_nick) between 3 and 20
//     and p_nick !~ '\d{4}'                                        -- rok urodzenia
//     and p_nick !~ '\d{3}[\s.-]?\d{3}[\s.-]?\d{3}'                 -- numer telefonu
//     and lower(p_nick) !~ '(@|www\.|\.pl\M|\.com\M|https?:)'
//     and translate(regexp_replace(lower(p_nick), '[\s._-]', '', 'g'), '01345$v', 'oieassu')
//         !~ '(kurw|chuj|pizd|jeba|pierdol|huj|cwel|szmat|dziwk|debil|idiot|admin|ortus|moderator)'
//     -- imię i nazwisko: ten sam wzorzec i ta sama lista co nickProblem() w index.html (trzymać w zgodzie!)
//     and lower(p_nick) !~ '^\S+\s+\S*(ski|ska|cki|cka|dzki|dzka|wicz|czyk|czak|iak|owiak)$'
//     and lower(p_nick) !~ '^\S+\s+(nowak|wójcik|wojcik|mazur|zając|zajac|król|krol|wieczorek|wróbel|wrobel|dudek|pawlak|sikora|baran|duda|kaczmarek|kowal|lis|wilk|sadowski|marciniak|pietrzak)$'
//     and p_nick !~ '^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+ [A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+$'
// $$;
//
// create or replace function ortus_submit_score(
//   p_nick text, p_xp integer, p_badges integer, p_mastered integer, p_streak integer,
//   p_week_xp integer, p_week_key text, p_level text, p_lesson_id text
// ) returns void
// language plpgsql security definer set search_path = public as $$
// declare
//   v_uid uuid := auth.uid();
//   v_prev record;
//   v_delta integer;
//   v_recent integer;
//   v_xp integer;
//   v_age_days integer;
// begin
//   if v_uid is null then raise exception 'not authenticated'; end if;
//   if not ortus_nick_ok(p_nick) then raise exception 'bad nick'; end if;
//   if p_level not in ('1-2','3-4','5-6') then p_level := '1-2'; end if;
//
//   select * into v_prev from ortus_ranking where user_id = v_uid;
//   v_delta := greatest(0, coalesce(p_xp,0) - coalesce(v_prev.xp,0));
//
//   -- bez identyfikatora lekcji zgłoszenie tylko odświeża pseudonim i poziom
//   if p_lesson_id is null or char_length(p_lesson_id) < 4 then v_delta := 0; end if;
//   -- ta sama lekcja nie liczy się dwa razy
//   if v_delta > 0 and exists (select 1 from ortus_lessons where lesson_id = p_lesson_id) then v_delta := 0; end if;
//   -- limity: 300 XP na zgłoszenie, 40 zgłoszeń na godzinę
//   select count(*) into v_recent from ortus_lessons where user_id = v_uid and created_at > now() - interval '1 hour';
//   if v_recent >= 40 then v_delta := 0; end if;
//   v_delta := least(v_delta, 300);
//   if v_delta > 0 then
//     insert into ortus_lessons(lesson_id, user_id, xp_delta) values (p_lesson_id, v_uid, v_delta);
//   end if;
//   v_xp := coalesce(v_prev.xp,0) + v_delta;
//
//   -- wiek konta w dniach: passa sprzed założenia konta nie jest weryfikowalna, więc do rankingu nie wchodzi
//   select greatest(1, floor(extract(epoch from now() - created_at) / 86400)::integer + 1)
//     into v_age_days from auth.users where id = v_uid;
//
//   insert into ortus_ranking (user_id, nick, xp, badges, mastered, streak, week_xp, week_key, level, updated_at)
//   values (v_uid, p_nick, v_xp,
//           least(greatest(coalesce(p_badges,0), 0), 44),
//           least(greatest(coalesce(p_mastered,0), 0), v_xp / 30),
//           least(greatest(coalesce(p_streak,0), 0), coalesce(v_age_days, 1)),
//           case when v_prev.week_key = p_week_key then coalesce(v_prev.week_xp,0) + v_delta else v_delta end,
//           p_week_key, p_level, now())
//   on conflict (user_id) do update set
//     nick = excluded.nick, xp = excluded.xp, badges = excluded.badges, mastered = excluded.mastered,
//     streak = excluded.streak, week_xp = excluded.week_xp, week_key = excluded.week_key,
//     level = excluded.level, updated_at = now();
// end $$;
// revoke all on function ortus_submit_score(text,integer,integer,integer,integer,integer,text,text,text) from public;
// grant execute on function ortus_submit_score(text,integer,integer,integer,integer,integer,text,text,text) to authenticated;
//
// -- po wdrożeniu funkcji: cofnij prawo insert/update na ortus_ranking dla klienta,
// -- żeby jedyną drogą zapisu była funkcja (usunięcie własnego wiersza zostaje):
// drop policy if exists "ranking - wlasny zapis"  on ortus_ranking;
// drop policy if exists "ranking - wlasna zmiana" on ortus_ranking;
// -- i przełącz w tym pliku: ORTUS_FEATURES.ranking = "all"
//
// -- 3c) RANKING BEZ IDENTYFIKATORÓW KONT ---------------------------------
// -- Aplikacja czyta ranking z widoku, który nie ma kolumny user_id. Po jego utworzeniu
// -- odbierz publiczny odczyt tabeli — wtedy identyfikatorów cudzych kont nie da się
// -- pobrać nawet zapytaniem z konsoli. (Bez widoku aplikacja czyta tabelę, też bez user_id.)
// create or replace view ortus_ranking_public with (security_invoker = false) as
//   select nick, xp, badges, mastered, streak, week_xp, week_key, level, updated_at from ortus_ranking;
// grant select on ortus_ranking_public to anon, authenticated;
// drop policy if exists "ranking - odczyt publiczny" on ortus_ranking;
// drop policy if exists "ranking - wlasny odczyt"    on ortus_ranking;
// create policy "ranking - wlasny odczyt" on ortus_ranking for select using (auth.uid() = user_id);
//
// -- 3d) RETENCJA: konta bez logowania od 24 miesięcy ----------------------
// -- Polityka prywatności obiecuje usuwanie takich kont — to zadanie robi to raz dziennie.
// -- Wymaga włączenia rozszerzenia pg_cron (Database → Extensions). Usunięcie użytkownika
// -- kasuje też postępy, wpis w rankingu i rejestr lekcji (on delete cascade).
// create extension if not exists pg_cron;
// create or replace function ortus_purge_inactive() returns integer
// language plpgsql security definer set search_path = public as $$
// declare v_n integer;
// begin
//   -- last_sign_in_at rośnie tylko przy logowaniu, nie przy odświeżeniu sesji — dziecko zalogowane
//   -- raz na tablecie gra latami bez „logowania”. Drugi sygnał to zapis postępu w chmurze.
//   with gone as (
//     delete from auth.users u
//     where coalesce(u.last_sign_in_at, u.created_at) < now() - interval '24 months'
//       and not exists (select 1 from ortus_progress p where p.user_id = u.id and p.updated_at > now() - interval '24 months')
//     returning id
//   ) select count(*) into v_n from gone;
//   return v_n;
// end $$;
// select cron.schedule('ortus-purge-inactive', '15 3 * * *', $$select ortus_purge_inactive()$$);
//
// -- 4) ADRES POWROTU PO LOGOWANIU ---------------------------------------
//    Authentication → URL Configuration → Redirect URLs → dodaj:
//    https://niekazmuliczyc.pl/gry/ortografia/**
//
// -- 5) GOOGLE I FACEBOOK — już działają w tym projekcie, nic nie zmieniasz.
//
// UWAGA: klucz powyżej to "publishable" — jest bezpieczny w kodzie strony,
// bo o dostępie decydują polityki RLS. Klucza "sb_secret_..." NIE wolno tu wklejać.
//
// PRZED WDROŻENIEM sprawdź trzy rzeczy:
//   a) zalogowany użytkownik widzi i zmienia wyłącznie swój wiersz w ortus_progress,
//   b) nie da się podmienić cudzego wiersza w ortus_ranking,
//   c) ranking wczytuje się bez błędu na koncie, które nigdy nie grało.
