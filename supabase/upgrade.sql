-- Run after setup.sql (also works for an existing v1 island). Run exactly once.
begin;
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
commit;
