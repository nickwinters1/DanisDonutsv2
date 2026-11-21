-- OPTIONAL. Run once in the Supabase SQL Editor ONLY if you want new notes to appear
-- immediately, without waiting in the approval queue.
--
-- What it does: every new message is saved as "approved" the moment it's sent, so it shows
-- up on the island right away (as long as the surprise is open). Organizers can still Hide
-- (reject) or Delete any note at any time, from the dashboard or right on the wall.
-- Private notes are still never shown publicly.
--
-- Recommended only for small, trusted groups: with this on, anything someone types is public
-- until an organizer removes it. Undo it any time with optional-require-approval.sql.
begin;

create or replace function public.island_auto_approve() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.status := 'approved';
  return new;
end $$;

drop trigger if exists island_auto_approve on public.island_messages;
create trigger island_auto_approve before insert on public.island_messages
  for each row execute function public.island_auto_approve();

-- Visitors still can't choose a status themselves (they have no insert privilege on that
-- column); the policy just has to accept the "approved" value the trigger sets.
drop policy if exists "visitors submit pending notes" on public.island_messages;
create policy "visitors submit pending notes" on public.island_messages for insert to anon,authenticated
  with check (status in ('pending','approved') and exists (select 1 from public.island_event e where e.id=event_id));

commit;
