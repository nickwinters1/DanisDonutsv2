-- Run once in a NEW Supabase project's SQL editor. Public browser keys only.
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
-- After creating your organizer user in Auth > Users, run this separately with the actual UUID:
-- insert into public.island_admins(user_id) values ('YOUR-USER-UUID');
