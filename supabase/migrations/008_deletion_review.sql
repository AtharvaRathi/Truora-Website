alter table public.account_deletion_requests add column status text not null default 'pending' check(status in ('pending','reviewing'));
create function public.workspace_deletion_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.team_members where user_id=auth.uid() and active and role='admin') then raise exception 'Permission denied';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'created_at',r.created_at,'status',r.status,'name',p.name,'email',u.email)) from public.account_deletion_requests r join public.profiles p on p.id=r.user_id join auth.users u on u.id=r.user_id),'[]'::jsonb);
end;$$;
create function public.review_account_deletion(p_user uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.team_members where user_id=auth.uid() and active and role='admin') then raise exception 'Permission denied';end if;
 update public.account_deletion_requests set status='reviewing' where user_id=p_user and status='pending';
 if found then insert into public.workspace_audit(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'deletion_review','customer',p_user,'{}');end if;
end;$$;
revoke all on function public.workspace_deletion_requests(),public.review_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.workspace_deletion_requests(),public.review_account_deletion(uuid) to authenticated;
