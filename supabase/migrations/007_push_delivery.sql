-- Server-only push outbox. Device registration and dispatch require separate setup.
create table public.push_outbox(id uuid primary key default gen_random_uuid(),notification_id uuid not null references public.app_notifications(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,attempts integer not null default 0,available_at timestamptz not null default now(),delivered_at timestamptz,last_error text);
create index push_outbox_ready on public.push_outbox(available_at) where delivered_at is null;
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from public,anon,authenticated;
create function public.enqueue_push() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.push_outbox(notification_id,user_id) values(new.id,new.user_id);return new;end;$$;
revoke all on function public.enqueue_push() from public,anon,authenticated;
create trigger queue_notification_push after insert on public.app_notifications for each row execute function public.enqueue_push();
create function public.claim_push_batch() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with selected as(select id from public.push_outbox where delivered_at is null and attempts<5 and available_at<=now() order by available_at limit 50 for update skip locked),claimed as(update public.push_outbox p set attempts=attempts+1,available_at=now()+interval '5 minutes' from selected s where p.id=s.id returning p.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'user_id',c.user_id,'tokens',coalesce((select jsonb_agg(d.token) from public.push_devices d where d.user_id=c.user_id),'[]'::jsonb))),'[]'::jsonb) into result from claimed c;return result;
end;$$;
create function public.finish_push(p_id uuid,p_success boolean,p_error text default '',p_invalid_tokens jsonb default '[]') returns void language plpgsql security definer set search_path='' as $$
begin
 update public.push_outbox set delivered_at=case when p_success then now() else null end,last_error=left(p_error,100),available_at=now()+interval '5 minutes' where id=p_id;
 delete from public.push_devices where user_id=(select user_id from public.push_outbox where id=p_id) and token in (select jsonb_array_elements_text(p_invalid_tokens));
end;$$;
revoke all on function public.claim_push_batch(),public.finish_push(uuid,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_push_batch(),public.finish_push(uuid,boolean,text,jsonb) to service_role;
