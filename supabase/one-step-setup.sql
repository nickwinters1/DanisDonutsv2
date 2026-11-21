-- 🍩 Dani's Donut Island: ONE-STEP database setup
--
--   1. First create your organizer login in Supabase:
--      Authentication → Users → Add user → Create new user
--      (your email + a strong password, tick "Auto Confirm User").
--   2. Then paste this WHOLE file into SQL Editor → New query and click Run. Run it once.
--      You should see: "All set! <your email> is the organizer."
--
-- It's exactly setup.sql + upgrade.sql, plus one line that makes your login the organizer,
-- all in one go: if anything goes wrong, nothing is changed and you can simply run it again.
-- The website only ever uses the PUBLIC (publishable / anon) key. Never use a secret or service_role key.

-- Safety checks: stop (without changing anything) if it's too early or already done.
do $$
begin
  if to_regclass('public.island_messages') is not null or to_regclass('public.island_event') is not null then
    raise exception 'The island is already set up in this project, so nothing was changed. (This script only needs to run once.)';
  end if;
  if not exists (select 1 from auth.users) then
    raise exception 'Create your organizer login first (Authentication → Users → Add user), then run this again.';
  end if;
end $$;

-- ── setup.sql ───────────────────────────────────────────────────────────────
create table public.island_event (
 singleton boolean primary key default true check (singleton),
 id text not null check (id ~ '^[a-zA-Z0-9-]{1,60}$'),
 title text not null check (char_length(title) between 1 and 100),
 revealed boolean not null default false
);
insert into public.island_event(id,title,revealed) values ('dani-celebration','A celebration for Dani',false);
create table public.island_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.island_messages (
 id uuid primary key default gen_random_uuid(),
 event_id text not null check (event_id ~ '^[a-zA-Z0-9-]{1,60}$'),
 category text not null check (category in ('note','memory','clip','card','letter','capsule')),
 author text not null check (char_length(author) between 1 and 60),
 title text not null default '' check (char_length(title)<=100),
 body text not null check (char_length(trim(body)) between 1 and 2500),
 link text check (link is null or (char_length(link)<=500 and link ~ '^https://')),
 visibility text not null check (visibility in ('public','private')),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
alter table public.island_event enable row level security;
alter table public.island_admins enable row level security;
alter table public.island_messages enable row level security;
create policy "read event" on public.island_event for select to anon,authenticated using (true);
create policy "read own organizer permission" on public.island_admins for select to authenticated using (user_id=auth.uid());
create or replace function public.is_island_admin() returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.island_admins where user_id=auth.uid()) $$;
revoke all on function public.is_island_admin() from public;
grant execute on function public.is_island_admin() to authenticated;
create policy "organizer updates edition" on public.island_event for update to authenticated using (public.is_island_admin()) with check (public.is_island_admin());
create policy "public reads revealed approved notes" on public.island_messages for select to anon,authenticated using (status='approved' and visibility='public' and exists (select 1 from public.island_event e where e.id=event_id and e.revealed));
create policy "visitors submit pending notes" on public.island_messages for insert to anon,authenticated with check (status='pending' and exists (select 1 from public.island_event e where e.id=event_id));
create policy "organizer reads all" on public.island_messages for select to authenticated using (public.is_island_admin());
create policy "organizer moderates" on public.island_messages for update to authenticated using (public.is_island_admin()) with check (public.is_island_admin());
create policy "organizer deletes" on public.island_messages for delete to authenticated using (public.is_island_admin());
-- Limit actual database privileges too, not just RLS.
revoke all on public.island_event, public.island_admins, public.island_messages from anon,authenticated;
grant select on public.island_event to anon,authenticated;
grant update(id,title,revealed) on public.island_event to authenticated;
grant select on public.island_admins to authenticated;
grant select on public.island_messages to anon,authenticated;
grant insert(event_id,category,author,title,body,link,visibility) on public.island_messages to anon,authenticated;
grant update(status),delete on public.island_messages to authenticated;

-- ── upgrade.sql ─────────────────────────────────────────────────────────────
alter table public.island_event add column finale_token text not null default '' check (char_length(finale_token)<=80);
grant update(finale_token) on public.island_event to authenticated;
alter table public.island_messages add column meta jsonb not null default '{}'::jsonb;
alter table public.island_messages add constraint island_meta_valid check (
 jsonb_typeof(meta)='object' and octet_length(meta::text)<=500
 and (meta - array['frosting','sprinkles','region','crystal','cardStyle'])='{}'::jsonb
 and (not (meta ? 'frosting') or coalesce(meta->>'frosting' in ('strawberry','blueberry','chocolate','vanilla','ocean','rainbow'),false))
 and (not (meta ? 'sprinkles') or coalesce(meta->>'sprinkles' in ('rainbow','stars','hearts','plain'),false))
 and (not (meta ? 'region') or coalesce(meta->>'region' in ('na','sa','eu','af','as','oc'),false))
 and (not (meta ? 'crystal') or coalesce(meta->>'crystal' in ('amethyst','rose','aqua','citrine','emerald'),false))
 and (not (meta ? 'cardStyle') or coalesce(meta->>'cardStyle' in ('gaming','friendship','donut','crystal','beach','collector'),false))
);
grant insert(meta) on public.island_messages to anon,authenticated;
create table public.island_archives (
 id text primary key check (id ~ '^[a-zA-Z0-9-]{1,60}$'),
 title text not null check (char_length(title) between 1 and 100),
 published_at timestamptz not null default now()
);
alter table public.island_archives enable row level security;
revoke all on public.island_archives from anon,authenticated;
grant select on public.island_archives to anon,authenticated;
grant insert(id,title),update(title) on public.island_archives to authenticated;
create policy "read published chapters" on public.island_archives for select to anon,authenticated using (true);
create policy "publish revealed chapter" on public.island_archives for insert to authenticated with check (public.is_island_admin() and exists(select 1 from public.island_event e where e.id=island_archives.id and e.revealed));
create policy "rename currently revealed chapter" on public.island_archives for update to authenticated using (public.is_island_admin()) with check (public.is_island_admin() and exists(select 1 from public.island_event e where e.id=island_archives.id and e.revealed));
-- Archived chapters remain published unless explicitly removed in the SQL editor.
create policy "read approved archived notes" on public.island_messages for select to anon,authenticated using (status='approved' and visibility='public' and exists(select 1 from public.island_archives a where a.id=island_messages.event_id));

-- ── make the first login (yours) the organizer ──────────────────────────────
-- More moderators later: create their login the same way, copy its User UID, and run
--   insert into public.island_admins(user_id) values ('THEIR-USER-UID');
insert into public.island_admins(user_id) select id from auth.users order by created_at limit 1;

select 'All set! ' || coalesce(u.email, u.id::text) || ' is the organizer.' as result
from public.island_admins a join auth.users u on u.id = a.user_id;
