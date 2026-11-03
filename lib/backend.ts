import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { AppUser, Profile } from './validation';

export function backendMode(): 'local' | 'supabase' | 'unconfigured' {
  if (process.env.APP_BACKEND === 'local' || (!process.env.APP_BACKEND && process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SUPABASE_URL)) return process.env.NODE_ENV==='production' || process.env.VERCEL || process.env.RENDER ? 'unconfigured' : 'local';
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? 'supabase' : 'unconfigured';
}
export async function supabase() {
  if(backendMode()!=='supabase')throw new Error('Online accounts are not configured. Please complete the Supabase setup.');
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{ cookieOptions:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'}, cookies: { getAll:()=>jar.getAll(),setAll:values=>values.forEach(({name,value,options})=>jar.set(name,value,options)) } });
}
export async function currentUser():Promise<AppUser|null> {
  if(backendMode()==='local')return (await import('./local-db')).localUser();
  if(backendMode()==='unconfigured')return null;
  const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user)return null;
  const {data,error}=await db.from('profiles').select('name,phone,address,city,pincode').eq('id',user.id).single();
  if(error)throw new Error('Unable to load your profile. Check that the database migration has been applied.');
  return {...data as Profile,id:user.id,email:user.email||''};
}
