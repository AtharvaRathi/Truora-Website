import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {ApiError} from './api';
import {backendMode} from './backend';
export function publicDatabase(token?:string){
 if(backendMode()!=='supabase')throw new ApiError('Online accounts are not configured.',503);
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:token?{headers:{Authorization:`Bearer ${token}`}}:undefined});
}
export async function mobileIdentity(request:Request){
 // A browser cookie or client-supplied user/role is never accepted here.
 const header=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~-]+$/.test(header)||header.length>8192)throw new ApiError('Sign in to continue.',401);
 const token=header.slice(7),db=publicDatabase(token);
 const {data,error}=await db.auth.getUser(token);if(error||!data.user)throw new ApiError('Your session expired. Sign in again.',401);
 return {db,user:data.user};
}
export function rpcFailure(message:string){
 const safe=/^(Team access required|Permission denied|Record changed|Invalid |Task |Provider |Customer |Account |Cannot |Verify |Unknown |Choose |Start |Too many|Cart changed|Unavailable cart)/.test(message);
 return new ApiError(safe?message:'Unable to save this change. Refresh and try again.',message==='Team access required'||message==='Permission denied'?403:/^(Record changed|Cart changed)/.test(message)?409:400);
}
