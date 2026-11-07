from pathlib import Path
import json
catalog=json.loads(Path('packages/core/data/phase-one.json').read_text())
prefix="""-- Shared mobile/web catalog metadata. Public sample content only.
create table public.catalog_content(id boolean primary key default true check(id), document jsonb not null);
alter table public.catalog_content enable row level security;
revoke all on public.catalog_content from public,anon,authenticated;
insert into public.catalog_content values(true,$content$"""+json.dumps(catalog,separators=(',',':'))+"""$content$::jsonb);
create function public.catalog_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('items',coalesce((select jsonb_agg(coalesce((select v from jsonb_array_elements(c.document->'items') v where v->>'id'=p.id),'{}'::jsonb)||jsonb_build_object('id',p.id,'name',p.name,'price',p.price,'rental7',p.rental7,'rental30',p.rental30,'rentalDaily',p.rental_daily,'deposit',p.deposit,'kind',p.kind,'unit',p.unit)) from public.products p where p.active),'[]'::jsonb),
 'packages',coalesce((select jsonb_agg(coalesce((select v from jsonb_array_elements(c.document->'packages') v where v->>'slug'=t.slug),'{}'::jsonb)||jsonb_build_object('slug',t.slug,'name',t.name,'weeks',t.weeks,'lines',t.lines)) from public.recovery_templates t),'[]'::jsonb)) from public.catalog_content c where id=true;
$$;
revoke all on function public.catalog_snapshot() from public;
grant execute on function public.catalog_snapshot() to anon,authenticated;

create table public.account_carts(user_id uuid primary key references auth.users(id) on delete cascade,lines jsonb not null default '[]',version integer not null default 0,updated_at timestamptz not null default now());
alter table public.account_carts enable row level security;
revoke all on public.account_carts from public,anon,authenticated;
create function public.cart_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'Sign in required';end if;
 select jsonb_build_object('lines',lines,'version',version) into result from public.account_carts where user_id=uid;
 return coalesce(result,'{"lines":[],"version":0}'::jsonb);
end;$$;
create function public.save_cart(p_lines jsonb,p_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); item jsonb; product public.products; current_version integer;
begin
 if uid is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,3));
 select version into current_version from public.account_carts where user_id=uid;
 if coalesce(current_version,0)<>p_version then raise exception 'Cart changed on another device. Refresh before retrying.';end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)>100 then raise exception 'Invalid cart';end if;
 for item in select value from jsonb_array_elements(p_lines) loop
  select * into product from public.products where id=item->>'productId' and active;
  if not found or coalesce(item->>'mode','') not in ('purchase','rental','service') or coalesce((item->>'quantity')::numeric,0) not between 1 and 60 or coalesce((item->>'days')::numeric,0) not between 1 and 90 or (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or (item->>'days')::numeric<>trunc((item->>'days')::numeric) then raise exception 'Invalid cart item';end if;
  if (item->>'mode'='service')<>(product.kind='service') or (item->>'mode'='purchase' and product.price<=0) or (item->>'mode'='rental' and product.rental7<=0) then raise exception 'Unavailable cart mode';end if;
  if item ? 'packageSlug' and not exists(select 1 from public.recovery_templates where slug=item->>'packageSlug') then raise exception 'Unknown recovery package';end if;
 end loop;
 insert into public.account_carts(user_id,lines,version) values(uid,p_lines,1) on conflict(user_id) do update set lines=excluded.lines,version=public.account_carts.version+1,updated_at=now();
 return public.cart_snapshot();
end;$$;
revoke all on function public.cart_snapshot(),public.save_cart(jsonb,integer) from public;
grant execute on function public.cart_snapshot(),public.save_cart(jsonb,integer) to authenticated;

-- Notification text intentionally contains no patient/clinical details.
create table public.app_notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null default 'Truora update',body text not null default 'Open Truora to view your latest updates.',read_at timestamptz,created_at timestamptz not null default now());
create index app_notifications_user_created on public.app_notifications(user_id,created_at desc);
alter table public.app_notifications enable row level security;
revoke all on public.app_notifications from public,anon,authenticated;
grant select on public.app_notifications to authenticated;
grant update(read_at) on public.app_notifications to authenticated;
create policy notifications_owner_read on public.app_notifications for select to authenticated using((select auth.uid())=user_id);
create policy notifications_owner_update on public.app_notifications for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create table public.push_devices(user_id uuid not null references auth.users(id) on delete cascade,token text not null,platform text not null check(platform in ('ios','android')),updated_at timestamptz not null default now(),primary key(user_id,token));
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public,anon,authenticated;
create function public.register_push_device(p_token text,p_platform text,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if p_token !~ '^ExponentPushToken\\[[A-Za-z0-9_-]+\\]$' and p_token !~ '^ExpoPushToken\\[[A-Za-z0-9_-]+\\]$' then raise exception 'Invalid notification token';end if;
 if p_remove then delete from public.push_devices where user_id=auth.uid() and token=p_token;
 else
 if p_platform not in ('ios','android') then raise exception 'Invalid platform';end if;
 delete from public.push_devices where token=p_token;
 insert into public.push_devices values(auth.uid(),p_token,p_platform,now());
 end if;
end;$$;
revoke all on function public.register_push_device(text,text,boolean) from public;
grant execute on function public.register_push_device(text,text,boolean) to authenticated;

-- Private signal channels carry no record content; every refresh rechecks access.
create function public.emit_app_signal(p_user uuid,p_notify boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_user is null then return;end if;
 if p_notify then insert into public.app_notifications(user_id) values(p_user);end if;
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
  perform realtime.send('{"refresh":true}'::jsonb,'change','user:'||p_user::text,true);
 end if;
end;$$;
revoke all on function public.emit_app_signal(uuid,boolean) from public,anon,authenticated;
create function public.app_change_signal() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end; old_data jsonb; u uuid;
begin
 if TG_TABLE_NAME in ('orders','service_requests','recovery_plans','account_carts') then
  perform public.emit_app_signal((row_data->>'user_id')::uuid,TG_TABLE_NAME<>'account_carts');
 elsif TG_TABLE_NAME='profiles' then perform public.emit_app_signal((row_data->>'id')::uuid,false);
 elsif TG_TABLE_NAME='care_tasks' then
  perform public.emit_app_signal((row_data->>'customer_id')::uuid,true);
  perform public.emit_app_signal((row_data->>'provider_id')::uuid,true);
  if TG_OP='UPDATE' and old.provider_id is distinct from new.provider_id then perform public.emit_app_signal(old.provider_id,false);end if;
 elsif TG_TABLE_NAME='team_members' then perform public.emit_app_signal((row_data->>'user_id')::uuid,false);
 end if;
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
  if TG_TABLE_NAME in ('products','recovery_templates','catalog_content') then perform realtime.send('{"refresh":true}'::jsonb,'change','catalog',true);
  elsif TG_TABLE_NAME<>'account_carts' then perform realtime.send('{"refresh":true}'::jsonb,'change','operations',true);end if;
 end if;
 return null;
end;$$;
revoke all on function public.app_change_signal() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['orders','service_requests','recovery_plans','care_tasks','team_members','workspace_notes','profiles','account_carts','products','recovery_templates','catalog_content'] loop
 execute format('create trigger app_signal after insert or update or delete on public.%I for each row execute function public.app_change_signal()',t);
end loop;end;$$;

-- Owner-requested deletion enters an auditable review queue; no silent record destruction.
create table public.account_deletion_requests(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public,anon,authenticated;
create function public.request_account_deletion() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 insert into public.account_deletion_requests values(auth.uid(),now()) on conflict do nothing;
end;$$;
revoke all on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;
"""
Path('supabase/migrations/005_mobile_sync.sql').write_text(prefix)
