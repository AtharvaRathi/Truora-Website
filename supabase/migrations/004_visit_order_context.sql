-- Preserve order and request contact context when scheduling standalone care.
create or replace function public.workspace_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();member public.team_members;ops boolean;manages boolean;result jsonb;
begin
 select * into member from public.team_members where user_id=uid and active;
 if not found then raise exception 'Team access required';end if;
 ops:=member.role in ('admin','manager','staff');manages:=member.role in ('admin','manager');
 result:=jsonb_build_object(
 'member',(select to_jsonb(member)||jsonb_build_object('name',p.name) from public.profiles p where p.id=uid),
 'team',coalesce((select jsonb_agg(x) from (select m.user_id,m.role,m.specialty,m.active,p.name,case when member.role='admin' then u.email else null end as email from public.team_members m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id where ops or m.user_id=uid order by p.name limit 200)x),'[]'),
 'customers',case when ops then coalesce((select jsonb_agg(x) from (select p.*,u.email,u.created_at from public.profiles p join auth.users u on u.id=p.id where (not exists(select 1 from public.team_members t where t.user_id=p.id) or exists(select 1 from public.orders o where o.user_id=p.id) or exists(select 1 from public.service_requests r where r.user_id=p.id)) order by u.created_at desc limit 200)x),'[]') else '[]'::jsonb end,
 'orders',case when ops then coalesce((select jsonb_agg(x) from (select id,user_id,created_at,status,payment_status,subtotal,deposit,total,address,items,rental_start from public.orders order by created_at desc limit 200)x),'[]') else '[]'::jsonb end,
 'plans',case when ops then coalesce((select jsonb_agg(x) from (select id,user_id,order_id,package_slug,name,status,created_at,updated_at,events from public.recovery_plans order by created_at desc limit 200)x),'[]') else '[]'::jsonb end,
 'requests',case when ops then coalesce((select jsonb_agg(x) from (select id,user_id,created_at,kind,subject,phone,preferred_date,preferred_time,notes,status from public.service_requests order by created_at desc limit 200)x),'[]') else '[]'::jsonb end,
 'tasks',coalesce((select jsonb_agg(x) from (select t.*,jsonb_build_object('name',p.name,'phone',p.phone,'address',p.address,'city',p.city,'pincode',p.pincode)||coalesce(o.address,'{}'::jsonb)||jsonb_build_object('phone',coalesce(nullif(o.address->>'phone',''),nullif(sr.phone,''),p.phone)) as customer,pp.name as provider_name from public.care_tasks t join public.profiles p on p.id=t.customer_id join public.profiles pp on pp.id=t.provider_id left join public.orders o on o.id=t.order_id left join public.service_requests sr on sr.id=t.request_id where (ops or t.provider_id=uid) and t.starts_at>=now()-interval '7 days' and t.starts_at<=now()+interval '61 days' order by t.starts_at limit 200)x),'[]'),
 'notes',case when ops then coalesce((select jsonb_agg(x) from (select n.id,n.entity_type,n.entity_id,n.body,n.created_at,p.name as author_name from public.workspace_notes n join public.profiles p on p.id=n.author_id order by n.created_at desc limit 200)x),'[]') else '[]'::jsonb end,
 'audit',case when manages then coalesce((select jsonb_agg(x) from (select a.id,a.action,a.entity_type,a.entity_id,a.details,a.created_at,p.name as actor_name from public.workspace_audit a join public.profiles p on p.id=a.actor_id order by a.created_at desc limit 100)x),'[]') else '[]'::jsonb end,
 'counts',jsonb_build_object('customers',case when ops then (select count(*) from public.profiles p where (not exists(select 1 from public.team_members t where t.user_id=p.id) or exists(select 1 from public.orders o where o.user_id=p.id) or exists(select 1 from public.service_requests r where r.user_id=p.id))) else 0 end,'orders',case when ops then (select count(*) from public.orders) else 0 end,'activePlans',case when ops then (select count(*) from public.recovery_plans where status not in ('completed','cancelled')) else 0 end,'openRequests',case when ops then (select count(*) from public.service_requests where status not in ('resolved','cancelled')) else 0 end,'upcomingTasks',(select count(*) from public.care_tasks where (ops or provider_id=uid) and status not in ('completed','cancelled') and starts_at>=now())));
 return result;
end;$$;

create or replace function public.workspace_action(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();member public.team_members;target uuid;action text:=p_input->>'action';state text:=p_input->>'status';old_state text;entity text;customer uuid;provider uuid;plan uuid;req uuid;ord uuid;service public.products;task public.care_tasks;starts timestamptz;duration integer;specialty text;expected_specialty text;details jsonb:='{}';stages text[];target_user uuid;
begin
 select * into member from public.team_members where user_id=uid and active;
 if not found then raise exception 'Team access required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,3));
 if (select count(*) from public.workspace_audit where actor_id=uid and created_at>now()-interval '1 minute')>=60 then raise exception 'Too many changes. Please wait a minute.';end if;
 if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'Unknown action';end if;
 if action in ('recovery_status','order_status','request_status') then
  if member.role not in ('admin','manager','staff') or (action='recovery_status' and member.role='staff') then raise exception 'Permission denied';end if;
  target:=(p_input->>'id')::uuid;
  if action='recovery_status' then
   entity:='recovery';select status into old_state from public.recovery_plans where id=target for update;
   stages:=array['submitted','reviewed','scheduled','recovering','collection','completed'];
  elsif action='order_status' then
   entity:='order';select status into old_state from public.orders where id=target for update;
   stages:=array['demo_submitted','reviewed','preparing','dispatched','completed'];
  else
   entity:='request';select status into old_state from public.service_requests where id=target for update;
   stages:=array['demo_submitted','contacted','in_progress','resolved'];
  end if;
  if old_state is null then raise exception 'Unknown record';end if;
  if old_state is distinct from p_input->>'expected' then raise exception 'Record changed. Refresh and try again.';end if;
  if old_state in ('completed','resolved','cancelled') or state is null or (state<>'cancelled' and array_position(stages,state) is distinct from array_position(stages,old_state)+1) then raise exception 'Invalid status transition';end if;
  if action='recovery_status' then update public.recovery_plans set status=state where id=target;
  elsif action='order_status' then update public.orders set status=state where id=target;
  else update public.service_requests set status=state where id=target;end if;
  details:=jsonb_build_object('from',old_state,'to',state);
 elsif action='note' then
  if member.role='provider' then raise exception 'Permission denied';end if;
  entity:=p_input->>'entityType';target:=(p_input->>'id')::uuid;
  if not ((entity='customer' and exists(select 1 from public.profiles where id=target)) or (entity='order' and exists(select 1 from public.orders where id=target)) or (entity='recovery' and exists(select 1 from public.recovery_plans where id=target)) or (entity='request' and exists(select 1 from public.service_requests where id=target))) then raise exception 'Unknown record';end if;
  if length(btrim(coalesce(p_input->>'body',''))) not between 2 and 2000 then raise exception 'Choose a note between 2 and 2000 characters';end if;
  insert into public.workspace_notes(entity_type,entity_id,body,author_id) values(entity,target,btrim(p_input->>'body'),uid);
 elsif action='task_create' then
  if member.role='provider' then raise exception 'Permission denied';end if;
  entity:='task';customer:=(p_input->>'customerId')::uuid;provider:=(p_input->>'providerId')::uuid;plan:=(p_input->>'planId')::uuid;req:=(p_input->>'requestId')::uuid;
  if not exists(select 1 from public.profiles where id=customer) then raise exception 'Customer unavailable';end if;
  if plan is not null then select order_id into ord from public.recovery_plans where id=plan and user_id=customer and status not in ('completed','cancelled');if not found then raise exception 'Customer package unavailable';end if;end if;
  if req is not null and not exists(select 1 from public.service_requests where id=req and user_id=customer and status not in ('resolved','cancelled')) then raise exception 'Customer request unavailable';end if;
  if p_input->>'orderId' is not null then
   if (ord is not null and ord<>(p_input->>'orderId')::uuid) or not exists(select 1 from public.orders where id=(p_input->>'orderId')::uuid and user_id=customer and status<>'cancelled') then raise exception 'Customer order unavailable';end if;
   ord:=(p_input->>'orderId')::uuid;
  end if;
  select * into task from public.care_tasks where request_key=(p_input->>'requestKey')::uuid;
  if found then
   if task.customer_id is distinct from customer or task.provider_id is distinct from provider or task.plan_id is distinct from plan or task.order_id is distinct from ord or task.request_id is distinct from req or task.service_id is distinct from p_input->>'serviceId' or task.starts_at is distinct from (p_input->>'startsAt')::timestamptz or task.duration_minutes is distinct from (p_input->>'duration')::integer or task.instructions is distinct from coalesce(p_input->>'instructions','') then raise exception 'Task submission already exists with different details. Refresh the schedule.';end if;
   return jsonb_build_object('ok',true,'id',task.id);
  end if;
  select * into service from public.products where id=p_input->>'serviceId' and kind='service' and active;
  if not found then raise exception 'Unknown service';end if;
  select t.specialty into specialty from public.team_members t where user_id=provider and role='provider' and active for update;
  if not found then raise exception 'Provider unavailable';end if;
  expected_specialty:=case service.id when 'service-nursing-visit' then 'nurse' when 'service-physiotherapy-session' then 'physiotherapist' when 'service-doctor-tele-follow-up' then 'doctor' when 'service-dietitian-recovery-plan' then 'dietitian' when 'service-caregiver-shift-12-hours' then 'caregiver' else 'other' end;
  if specialty<>expected_specialty then raise exception 'Provider specialty does not match this service';end if;
  starts:=(p_input->>'startsAt')::timestamptz;duration:=(p_input->>'duration')::integer;
  if starts is null or starts<now()-interval '5 minutes' or starts>now()+interval '60 days' then raise exception 'Start time must be within the next 60 days';end if;
  if duration is null or duration not between 15 and 720 or length(coalesce(p_input->>'instructions',''))>1000 then raise exception 'Task details invalid';end if;
  if exists(select 1 from public.care_tasks where provider_id=provider and status not in ('cancelled','completed') and tstzrange(starts_at,starts_at+duration_minutes*interval '1 minute','[)')&&tstzrange(starts,starts+duration*interval '1 minute','[)')) then raise exception 'Provider already has a visit during this time';end if;
  insert into public.care_tasks(customer_id,plan_id,order_id,request_id,service_id,provider_id,title,starts_at,duration_minutes,instructions,request_key) values(customer,plan,ord,req,service.id,provider,service.name,starts,duration,coalesce(p_input->>'instructions',''),(p_input->>'requestKey')::uuid) returning id into target;
  details:=jsonb_build_object('provider_id',provider,'starts_at',starts,'customer_id',customer);
 elsif action='task_status' then
  entity:='task';target:=(p_input->>'id')::uuid;select * into task from public.care_tasks where id=target for update;
  if not found then raise exception 'Unknown task';end if;
  if member.role='provider' and task.provider_id<>uid then raise exception 'Permission denied';end if;
  if task.version is distinct from (p_input->>'version')::integer then raise exception 'Record changed. Refresh and try again.';end if;
  if length(coalesce(p_input->>'completionNote',''))>1000 then raise exception 'Task note is too long';end if;
  stages:=array['scheduled','accepted','in_progress','completed'];
  if task.status in ('completed','cancelled') or state is null or (state='cancelled' and member.role='provider') or (state<>'cancelled' and array_position(stages,state) is distinct from array_position(stages,task.status)+1) then raise exception 'Invalid status transition';end if;
  update public.care_tasks set status=state,completion_note=case when state='completed' then coalesce(p_input->>'completionNote','') else completion_note end,version=version+1 where id=target;
  details:=jsonb_build_object('from',task.status,'to',state);
 elsif action='team' then
  if member.role<>'admin' then raise exception 'Permission denied';end if;
  perform pg_advisory_xact_lock(740031);
  if (p_input->'identityVerified') is distinct from 'true'::jsonb then raise exception 'Verify the team member identity first';end if;
  select id into target_user from auth.users where lower(email)=lower(btrim(p_input->>'email'));
  if target_user is null then raise exception 'Account not found. Ask them to create their Truora account first.';end if;
  if target_user=uid then raise exception 'Cannot change your own access';end if;
  if coalesce(p_input->>'role','') not in ('admin','manager','staff','provider') or coalesce(p_input->>'specialty','') not in ('physiotherapist','nurse','caregiver','dietitian','doctor','other') or jsonb_typeof(p_input->'active') is distinct from 'boolean' then raise exception 'Unknown role or specialty';end if;
  if exists(select 1 from public.team_members where user_id=target_user and role='admin' and active) and (p_input->>'role'<>'admin' or not (p_input->>'active')::boolean) and (select count(*) from public.team_members where role='admin' and active)<=1 then raise exception 'Cannot remove the final administrator';end if;
  target:=target_user;entity:='team';select role into old_state from public.team_members where user_id=target;
  insert into public.team_members(user_id,role,specialty,active) values(target,p_input->>'role',p_input->>'specialty',(p_input->>'active')::boolean) on conflict(user_id) do update set role=excluded.role,specialty=excluded.specialty,active=excluded.active;
  details:=jsonb_build_object('from',old_state,'to',p_input->>'role','active',(p_input->>'active')::boolean,'identity_verified',true);
 else raise exception 'Unknown action';
 end if;
 insert into public.workspace_audit(actor_id,action,entity_type,entity_id,details) values(uid,action,entity,target,details);
 return jsonb_build_object('ok',true,'id',target);
end;$$;

revoke all on function public.workspace_snapshot(),public.workspace_action(jsonb) from public,anon;
grant execute on function public.workspace_snapshot(),public.workspace_action(jsonb) to authenticated;
