-- Undoes optional-auto-approve.sql: new notes go back to waiting in the approval queue
-- (the original behaviour from setup.sql). Notes that were already approved stay approved.
begin;

drop trigger if exists island_auto_approve on public.island_messages;
drop function if exists public.island_auto_approve();

drop policy if exists "visitors submit pending notes" on public.island_messages;
create policy "visitors submit pending notes" on public.island_messages for insert to anon,authenticated
  with check (status='pending' and exists (select 1 from public.island_event e where e.id=event_id));

commit;
