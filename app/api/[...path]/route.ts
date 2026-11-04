import { z } from 'zod';
import { backendMode, currentUser, supabase } from '@/lib/backend';
import { ApiError, apiError, json, readJson, sameOrigin } from '@/lib/api';
import { emailSchema, loginSchema, orderSchema, passwordSchema, profileSchema, requestSchema, signupSchema } from '@/lib/validation';
export const runtime='nodejs';
export const dynamic='force-dynamic';

async function pathOf(context:{params:Promise<{path:string[]}>}){return (await context.params).path.join('/')}
export async function GET(_request:Request,context:{params:Promise<{path:string[]}>}){
  try{
    const path=await pathOf(context);
    if(path==='auth/session')return json({user:await currentUser(),backend:backendMode()});
    if(path!=='account')throw new ApiError('Not found.',404);
    const user=await currentUser();if(!user)throw new ApiError('Sign in to continue.',401);
    if(backendMode()==='local'){const local=await import('@/lib/local-db');return json({user,orders:local.localOrders(user.id),requests:local.localRequests(user.id),recoveryPlans:local.localRecoveryPlans(user.id),visits:(await import('@/lib/local-workspace')).localCustomerVisits(user.id)})}
    const db=await supabase();const [orders,requests,recoveryPlans,visits]=await Promise.all([db.from('orders').select('id,created_at,status,total,deposit,subtotal,address,items,rental_start,payment_status').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),db.from('service_requests').select('id,created_at,kind,subject,phone,preferred_date,preferred_time,notes,status').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),db.from('recovery_plans').select('id,order_id,package_slug,name,status,created_at,updated_at,events').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),db.rpc('customer_visits')]);
    if(orders.error||requests.error||recoveryPlans.error||visits.error)throw new Error('Account data unavailable');return json({user,orders:orders.data,requests:requests.data,recoveryPlans:recoveryPlans.data,visits:visits.data});
  }catch(error){return apiError(error)}
}
export async function POST(request:Request,context:{params:Promise<{path:string[]}>}){
  try{
    sameOrigin(request);const path=await pathOf(context);const body=await readJson(request);const mode=backendMode();
    if(mode==='unconfigured')throw new ApiError('Online accounts are not configured. Please complete the Supabase setup.',503);
    if(path==='auth/signup'||path==='auth/login'){
      const input=path==='auth/signup'?signupSchema.parse(body):loginSchema.parse(body);
      if(mode==='local'){const local=await import('@/lib/local-db');local.localRateLimit(`auth:${input.email}`);if(path==='auth/signup')await local.localSignup('name' in input&&typeof input.name==='string'?input.name:'',input.email,input.password);else await local.localLogin(input.email,input.password);return json({user:await currentUser()})}
      const db=await supabase();
      if(path==='auth/signup'){const {data,error}=await db.auth.signUp({email:input.email,password:input.password,options:{data:{name:'name' in input&&typeof input.name==='string'?input.name:''},emailRedirectTo:`${request.headers.get('origin')}/auth/confirm`}});if(error)throw new ApiError(error.status===429?'Too many attempts. Please try again later.':'Unable to create this account. Try signing in or resetting your password.');return json({user:data.session?await currentUser():null,confirmationRequired:!data.session,message:'Check your email to confirm your account, then sign in.'})}
      const {error}=await db.auth.signInWithPassword({email:input.email,password:input.password});if(error)throw new ApiError('Email or password is incorrect, or your email is not confirmed.');return json({user:await currentUser()});
    }
    if(path==='auth/logout'){if(mode==='local')await (await import('@/lib/local-db')).localLogout();else{const {error}=await (await supabase()).auth.signOut();if(error)throw new Error('Logout failed')}return json({ok:true})}
    if(path==='auth/forgot'){
      const {email}=z.object({email:emailSchema}).parse(body);
      if(mode==='local'){const local=await import('@/lib/local-db');local.localRateLimit(`reset:${email}`,5);const token=local.localForgot(email);return json({message:'If that account exists, a reset can be requested. Local preview does not send email.',developmentResetUrl:token?`/reset-password?token=${token}`:null})}
      const {error}=await (await supabase()).auth.resetPasswordForEmail(email,{redirectTo:`${request.headers.get('origin')}/auth/confirm?next=/reset-password`});if(error&&error.status===429)throw new ApiError('Too many attempts. Please try again later.',429);return json({message:'If that account exists, a password reset email has been requested. Check your inbox.'});
    }
    if(path==='auth/reset'){
      const input=z.object({password:passwordSchema,token:z.string().max(128).optional()}).parse(body);
      if(mode==='local')await (await import('@/lib/local-db')).localReset(input.token||'',input.password);
      else{if(!await currentUser())throw new ApiError('Open the password reset link from your email first.',401);const {error}=await (await supabase()).auth.updateUser({password:input.password});if(error)throw new ApiError('Unable to update your password. Request a new reset link.');await (await supabase()).auth.signOut()}
      return json({ok:true});
    }
    const user=await currentUser();if(!user)throw new ApiError('Sign in to continue.',401);
    if(path==='account/profile'){
      const profile=profileSchema.parse(body);if(mode==='local')(await import('@/lib/local-db')).localProfile(user.id,profile);else{const {error}=await (await supabase()).from('profiles').update(profile).eq('id',user.id);if(error)throw new ApiError('Unable to save your profile. Please try again.')}
      return json({user:await currentUser()});
    }
    if(path==='orders'){
      const input=orderSchema.parse(body);
      if(input.rentalStart||input.lines.some(l=>l.mode==='rental')){const start=new Date(`${input.rentalStart}T00:00:00Z`);const today=new Date().toISOString().slice(0,10);if(!input.rentalStart||Number.isNaN(start.getTime())||start.toISOString().slice(0,10)!==input.rentalStart||input.rentalStart<today)throw new ApiError('Choose a valid rental start date from today onwards.')}
      if(mode==='local'){const local=await import('@/lib/local-db');local.localRateLimit(`orders:${user.id}`,30);return json({order:local.localOrder(user.id,input)},201)}
      const {data,error}=await (await supabase()).rpc('place_demo_order',{p_lines:input.lines,p_address:input.address,p_rental_start:input.rentalStart||null,p_request_key:input.idempotencyKey});if(error)throw new ApiError('Unable to place this order. Check availability and your details, then try again.');return json({order:data},201);
    }
    if(path==='requests'){
      const input=requestSchema.parse(body);if(input.preferredDate){const date=new Date(`${input.preferredDate}T00:00:00Z`);if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==input.preferredDate||input.preferredDate<new Date().toISOString().slice(0,10))throw new ApiError('Choose a valid date from today onwards.')}
      if(mode==='local'){const local=await import('@/lib/local-db');local.localRateLimit(`requests:${user.id}`,20);return json({request:local.localRequest(user.id,input)},201)}
      const {data,error}=await (await supabase()).rpc('submit_demo_request',{p_kind:input.kind,p_subject:input.subject,p_phone:input.phone,p_date:input.preferredDate||null,p_time:input.preferredTime,p_notes:input.notes,p_request_key:input.idempotencyKey});if(error)throw new ApiError('Unable to save your request. Check your details and try again.');return json({request:data},201);
    }
    throw new ApiError('Not found.',404);
  }catch(error){return apiError(error)}
}
