-- Run once in the Supabase SQL Editor. Prices are integer paise, all listings are demos.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '', phone text not null default '', address text not null default '',
 city text not null default '', pincode text not null default '',
 constraint profile_lengths check (length(name)<=80 and length(phone)<=20 and length(address)<=300 and length(city)<=80 and (pincode='' or pincode ~ '^\d{6}$'))
);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,name) values(new.id,left(coalesce(new.raw_user_meta_data->>'name',''),80));return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Backfill users created before the migration was applied.
insert into public.profiles(id,name) select id,left(coalesce(raw_user_meta_data->>'name',''),80) from auth.users on conflict do nothing;
create table public.products (
 id text primary key, name text not null, price integer not null check(price>0), rental7 integer not null check(rental7>0),
 rental30 integer not null check(rental30>0), deposit integer not null check(deposit>=0), active boolean not null default true
);
insert into public.products values ('bp-machine','BP Machine',179900,39900,99900,50000,true),('wheelchair','Wheelchair',649900,59900,149900,200000,true);
create table public.orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 request_key uuid not null, created_at timestamptz not null default now(), status text not null default 'demo_submitted',
 payment_status text not null default 'not_charged', subtotal integer not null, deposit integer not null,
 total integer not null, address jsonb not null, items jsonb not null, rental_start date,
 unique(user_id,request_key), check(total=subtotal+deposit and subtotal>0 and deposit>=0)
);
create table public.service_requests (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 request_key uuid not null,created_at timestamptz not null default now(),kind text not null check(kind in ('callback','service','package')),
 subject text not null,phone text not null,preferred_date date,preferred_time text not null check(preferred_time in ('Morning','Afternoon','Evening')),
 notes text not null default '',status text not null default 'demo_submitted',unique(user_id,request_key)
);
create index orders_user_created on public.orders(user_id,created_at desc);
create index requests_user_created on public.service_requests(user_id,created_at desc);
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.service_requests enable row level security;
revoke all on public.profiles,public.products,public.orders,public.service_requests from anon,authenticated;
grant select on public.products to anon,authenticated;
grant select on public.profiles,public.orders,public.service_requests to authenticated;
grant update(name,phone,address,city,pincode) on public.profiles to authenticated;
create policy profiles_own_read on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy profiles_own_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy products_public_read on public.products for select using(active);
create policy orders_own_read on public.orders for select to authenticated using((select auth.uid())=user_id);
create policy requests_own_read on public.service_requests for select to authenticated using((select auth.uid())=user_id);

create function public.place_demo_order(p_lines jsonb,p_address jsonb,p_rental_start date,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); item jsonb; product public.products; qty integer; days integer; mode text;
 unit_price integer; item_deposit integer; sub integer:=0; dep integer:=0; snapshot jsonb:='[]'; result public.orders;
begin
 if uid is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into result from public.orders where user_id=uid and request_key=p_request_key;
 if found then return to_jsonb(result)-'user_id'-'request_key';end if;
 if p_request_key is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)<1 or jsonb_array_length(p_lines)>20 then raise exception 'Invalid cart';end if;
 if jsonb_typeof(p_address) is distinct from 'object' or length(coalesce(p_address->>'name','')) not between 2 and 80
 or coalesce(p_address->>'phone','') !~ '^\+?[0-9 ()-]{7,20}$' or length(coalesce(p_address->>'address','')) not between 8 and 300
 or length(coalesce(p_address->>'city','')) not between 2 and 80 or coalesce(p_address->>'pincode','') !~ '^[0-9]{6}$' then raise exception 'Invalid address';end if;
 if (select count(*) from public.orders where user_id=uid and created_at>now()-interval '1 hour')>=30 then raise exception 'Too many orders';end if;
 for item in select * from jsonb_array_elements(p_lines) loop
  select * into product from public.products where id=item->>'productId' and active;
  if not found then raise exception 'Product unavailable';end if;
  if coalesce(item->>'quantity','') !~ '^[0-9]+$' or coalesce(item->>'days','') !~ '^[0-9]+$' then raise exception 'Invalid quantity';end if;
  qty:=(item->>'quantity')::integer;days:=(item->>'days')::integer;mode:=item->>'mode';
  if qty not between 1 and 10 or days not in (7,30) or mode is null or mode not in ('purchase','rental') then raise exception 'Invalid cart line';end if;
  if mode='rental' and (p_rental_start is null or p_rental_start<current_date) then raise exception 'Invalid rental date';end if;
  unit_price:=case when mode='purchase' then product.price when days=7 then product.rental7 else product.rental30 end;
  item_deposit:=case when mode='rental' then product.deposit else 0 end;
  sub:=sub+unit_price*qty;dep:=dep+item_deposit*qty;
  snapshot:=snapshot||jsonb_build_array(jsonb_build_object('productId',product.id,'name',product.name,'mode',mode,'quantity',qty,'days',days,'unitPrice',unit_price,'deposit',item_deposit));
 end loop;
 insert into public.orders(user_id,request_key,subtotal,deposit,total,address,items,rental_start)
 values(uid,p_request_key,sub,dep,sub+dep,jsonb_build_object('name',p_address->>'name','phone',p_address->>'phone','address',p_address->>'address','city',p_address->>'city','pincode',p_address->>'pincode'),snapshot,p_rental_start) returning * into result;
 return to_jsonb(result)-'user_id'-'request_key';
end;$$;
revoke all on function public.place_demo_order(jsonb,jsonb,date,uuid) from public,anon;
grant execute on function public.place_demo_order(jsonb,jsonb,date,uuid) to authenticated;

create function public.submit_demo_request(p_kind text,p_subject text,p_phone text,p_date date,p_time text,p_notes text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();result public.service_requests;
begin
 if uid is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 select * into result from public.service_requests where user_id=uid and request_key=p_request_key;
 if found then return to_jsonb(result)-'user_id'-'request_key';end if;
 if p_request_key is null or p_kind is null or p_kind not in ('callback','service','package') or length(coalesce(p_subject,'')) not between 2 and 100
 or coalesce(p_phone,'') !~ '^\+?[0-9 ()-]{7,20}$' or (p_date is not null and p_date<current_date)
 or p_time is null or p_time not in ('Morning','Afternoon','Evening') or p_notes is null or length(p_notes)>500 then raise exception 'Invalid request';end if;
 if (select count(*) from public.service_requests where user_id=uid and created_at>now()-interval '1 hour')>=20 then raise exception 'Too many requests';end if;
 insert into public.service_requests(user_id,request_key,kind,subject,phone,preferred_date,preferred_time,notes) values(uid,p_request_key,p_kind,p_subject,p_phone,p_date,p_time,p_notes) returning * into result;
 return to_jsonb(result)-'user_id'-'request_key';
end;$$;
revoke all on function public.submit_demo_request(text,text,text,date,text,text,uuid) from public,anon;
grant execute on function public.submit_demo_request(text,text,text,date,text,text,uuid) to authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;
