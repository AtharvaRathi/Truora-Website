import {z} from 'zod';
import {json,apiError,ApiError,readJson} from '@/lib/api';
import {mobileIdentity,rpcFailure} from '@/lib/mobile-backend';
import {catalogSnapshot} from '@/lib/catalog-server';
import {profileSchema,orderSchema,requestSchema,lineSchema} from '@/lib/validation';
import {workspaceActionSchema} from '@/lib/workspace';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
async function route(request:Request,context:Context,write:boolean){try{
 const path=(await context.params).path.join('/');
 if(!write&&path==='catalog')return json(await catalogSnapshot());
 const {db,user}=await mobileIdentity(request);
 if(!write){
  if(path==='account'){
   const [profile,orders,requests,plans,visits,membership]=await Promise.all([
    db.from('profiles').select('name,phone,address,city,pincode').eq('id',user.id).single(),
    db.from('orders').select('id,created_at,status,total,deposit,subtotal,address,items,rental_start,payment_status').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),
    db.from('service_requests').select('id,created_at,kind,subject,phone,preferred_date,preferred_time,notes,status').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),
    db.from('recovery_plans').select('id,order_id,package_slug,name,status,created_at,updated_at,events').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),
    db.rpc('customer_visits'),db.from('team_members').select('role,active,specialty').eq('user_id',user.id).maybeSingle()]);
   if([profile,orders,requests,plans,visits,membership].some(r=>r.error))throw new ApiError('Unable to load your account.',503);
   return json({user:{...profile.data,id:user.id,email:user.email},orders:orders.data,requests:requests.data,recoveryPlans:plans.data,visits:visits.data,member:membership.data?.active?membership.data:null});
  }
  if(path==='workspace'){const r=await db.rpc('workspace_snapshot');if(r.error)throw rpcFailure(r.error.message);return json(r.data)}
  if(path==='cart'){const r=await db.rpc('cart_snapshot');if(r.error)throw rpcFailure(r.error.message);return json(r.data)}
  if(path==='deletions'){const r=await db.rpc('workspace_deletion_requests');if(r.error)throw rpcFailure(r.error.message);return json(r.data)}
  if(path==='notifications'){const r=await db.from('app_notifications').select('id,title,body,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);if(r.error)throw new ApiError('Unable to load notifications.');return json({notifications:r.data})}
 }else{
  if(!request.headers.get('content-type')?.includes('application/json'))throw new ApiError('Use a JSON request.',415);
  const body=await readJson(request);
  if(path==='profile'){const r=await db.from('profiles').update(profileSchema.parse(body)).eq('id',user.id);if(r.error)throw new ApiError('Unable to save profile.');return json({ok:true})}
  if(path==='workspace'){const input=workspaceActionSchema.parse(body);const r=await db.rpc('workspace_action',{p_input:input});if(r.error)throw rpcFailure(r.error.message);return json(r.data)}
  if(path==='cart'){const input=z.object({lines:z.array(lineSchema).max(100),version:z.number().int().min(0)}).strict().parse(body);const r=await db.rpc('save_cart',{p_lines:input.lines,p_version:input.version});if(r.error)throw rpcFailure(r.error.message);return json(r.data)}
  if(path==='orders'){
   const input=orderSchema.parse(body);const r=await db.rpc('place_demo_order',{p_lines:input.lines,p_address:input.address,p_rental_start:input.rentalStart||null,p_request_key:input.idempotencyKey});if(r.error)throw new ApiError('Unable to place order. Check your selections and rental date.');return json({order:r.data},201);
  }
  if(path==='requests'){
   const i=requestSchema.parse(body);const r=await db.rpc('submit_demo_request',{p_kind:i.kind,p_subject:i.subject,p_phone:i.phone,p_date:i.preferredDate||null,p_time:i.preferredTime,p_notes:i.notes,p_request_key:i.idempotencyKey});if(r.error)throw new ApiError('Unable to submit request. Check your details.');return json({request:r.data},201);
  }
  if(path==='deletions/review'){const i=z.object({userId:z.string().uuid()}).parse(body);const r=await db.rpc('review_account_deletion',{p_user:i.userId});if(r.error)throw rpcFailure(r.error.message);return json({ok:true})}
  if(path==='notifications/read'){const i=z.object({id:z.string().uuid()}).parse(body);const r=await db.from('app_notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).eq('id',i.id);if(r.error)throw new ApiError('Unable to update notification.');return json({ok:true})}
  if(path==='notifications/device'){const i=z.object({token:z.string().max(250),platform:z.enum(['ios','android']),remove:z.boolean().default(false)}).parse(body);const r=await db.rpc('register_push_device',{p_token:i.token,p_platform:i.platform,p_remove:i.remove});if(r.error)throw new ApiError('Unable to register notifications.');return json({ok:true})}
  if(path==='account/delete'){z.object({confirmation:z.literal('DELETE')}).strict().parse(body);const r=await db.rpc('request_account_deletion');if(r.error)throw new ApiError('Unable to request deletion.');return json({ok:true,message:'Your deletion request is recorded for review. Contact pranjalrathi1907@gmail.com for assistance.'})}
 }
 throw new ApiError('Not found.',404);
}catch(e){return apiError(e)}}
function cors(r:Response){r.headers.set('Access-Control-Allow-Origin','*');return r}
export async function GET(r:Request,c:Context){return cors(await route(r,c,false))}
export async function POST(r:Request,c:Context){return cors(await route(r,c,true))}
export function OPTIONS(){return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600'}})}
