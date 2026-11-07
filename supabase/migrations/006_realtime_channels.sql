-- Supabase Realtime schema exists on hosted Supabase. No raw table grants needed.
create policy truora_private_receive on realtime.messages for select to authenticated using(
 realtime.topic()='user:'||(select auth.uid())::text
 or realtime.topic()='catalog'
 or (realtime.topic()='operations' and exists(select 1 from public.team_members where user_id=(select auth.uid()) and active and role in ('admin','manager','staff')))
);
create policy truora_catalog_receive on realtime.messages for select to anon using(realtime.topic()='catalog');
-- No INSERT policy: clients cannot forge change events.
