'use client';
import {useEffect} from 'react';
import {createClient} from '@supabase/supabase-js';
import {installCatalog} from '@/lib/catalog';
import {installPackages} from '@/lib/packages';
import {useApp} from './app-provider';
export const changeEvent='truora:change';
export function LiveSync(){
 const {user,backend}=useApp();
 useEffect(()=>{
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined,refreshTimer:ReturnType<typeof setInterval>|undefined;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const db=url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null;
  async function catalog(){try{const r=await fetch('/api/catalog',{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(stopped)return;installCatalog(data.items);installPackages(data.packages);window.dispatchEvent(new Event('truora:catalog'))}catch{}}
  function changed(){clearTimeout(timer);timer=setTimeout(()=>{if(!stopped){window.dispatchEvent(new Event(changeEvent));void catalog()}},250)}
  async function connect(){if(!db)return;
   if(user&&backend==='supabase'){
    const r=await fetch('/api/realtime',{headers:{'X-Truora-Client':'web'},cache:'no-store'});if(!r.ok)return;const {token}=await r.json();if(stopped)return;
    await db.realtime.setAuth(token);
    db.channel(`user:${user.id}`,{config:{private:true}}).on('broadcast',{event:'change'},changed).subscribe(status=>{if(status==='SUBSCRIBED')changed()});
    const membership=await createClient(url!,key!,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}}).from('team_members').select('role,active').eq('user_id',user.id).maybeSingle();
    // HTTP requests use the session token; realtime.setAuth only covers WebSockets.
    if(membership.data?.active&&membership.data.role!=='provider')db.channel('operations',{config:{private:true}}).on('broadcast',{event:'change'},changed).subscribe();
    refreshTimer=setInterval(()=>{void fetch('/api/realtime',{headers:{'X-Truora-Client':'web'},cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(d&&!stopped)void db.realtime.setAuth(d.token)}).catch(()=>{})},60000);
   }
   if(!stopped)db.channel('catalog',{config:{private:true}}).on('broadcast',{event:'change'},()=>void catalog()).subscribe();
  }
  void catalog();void connect().catch(()=>{});
  const focus=()=>{changed()};window.addEventListener('focus',focus);window.addEventListener('online',focus);
  return()=>{stopped=true;clearTimeout(timer);clearInterval(refreshTimer);window.removeEventListener('focus',focus);window.removeEventListener('online',focus);void db?.removeAllChannels()};
 },[user?.id,backend]);
 return null;
}
