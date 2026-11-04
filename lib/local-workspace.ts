import 'server-only';
import {randomUUID} from 'node:crypto';
import {localDb} from './local-db';
import {ApiError} from './api';
import {getProduct} from './catalog';
import {recoveryStages} from './packages';
import {type WorkspaceAction,type WorkspaceData,type TeamMember,type Customer,type CareTask,type WorkNote,type AuditEntry,type CustomerVisit,orderStatuses,requestStatuses,taskStatuses} from './workspace';
import type {Order,ServiceRequest} from './validation';
import type {RecoveryPlan} from './packages';
export function workspaceDb(){const db=localDb();db.exec(`
 CREATE TABLE IF NOT EXISTS team_members(user_id TEXT PRIMARY KEY REFERENCES users(id),role TEXT NOT NULL,specialty TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS care_tasks(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS workspace_notes(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS workspace_audit(id TEXT PRIMARY KEY,payload TEXT NOT NULL);`);return db}
function customers():Customer[]{return (workspaceDb().prepare('select id,email,profile,rowid from users').all() as {id:string;email:string;profile:string;rowid:number}[]).map(u=>({...JSON.parse(u.profile),id:u.id,email:u.email,created_at:''})).reverse()}
function team():TeamMember[]{const users=customers();return (workspaceDb().prepare('select * from team_members').all() as {user_id:string;role:TeamMember['role'];specialty:string;active:number}[]).map(m=>({...m,active:!!m.active,name:users.find(u=>u.id===m.user_id)?.name||'Team member',email:users.find(u=>u.id===m.user_id)?.email}))}
function member(id:string){const m=team().find(t=>t.user_id===id&&t.active);if(!m)throw new ApiError('This account does not have team access.',403);return m}
function records<T>(table:string):(T&{user_id:string})[]{return (workspaceDb().prepare(`select user_id,payload from ${table} order by rowid desc`).all() as {user_id:string;payload:string}[]).map(r=>({...JSON.parse(r.payload),user_id:r.user_id}))}
function payloads<T>(table:string):T[]{return (workspaceDb().prepare(`select payload from ${table} order by rowid desc`).all() as {payload:string}[]).map(r=>JSON.parse(r.payload))}
function persist(table:string,id:string,value:unknown){workspaceDb().prepare(`update ${table} set payload=? where id=?`).run(JSON.stringify(value),id)}
function profileOnly(p:import('./validation').Profile){return {name:p.name,phone:p.phone,address:p.address,city:p.city,pincode:p.pincode}}
export function localCustomerVisits(id:string):CustomerVisit[]{return payloads<CareTask>('care_tasks').filter(t=>t.customer_id===id).slice(0,100).map(t=>({id:t.id,title:t.title,starts_at:t.starts_at,duration_minutes:t.duration_minutes,status:t.status,plan_id:t.plan_id,provider_name:team().find(p=>p.user_id===t.provider_id)?.name||'Provider'}))}
export function localWorkspace(id:string):WorkspaceData{
 const m=member(id),ops=m.role!=='provider',manages=m.role==='admin'||m.role==='manager',people=customers(),members=team();
 const orders=records<Order>('orders'),plans=records<RecoveryPlan>('recovery_plans'),requests=records<ServiceRequest>('requests');
 const allTasks=payloads<CareTask>('care_tasks').filter(t=>ops||t.provider_id===id);
 return {member:m,customers:ops?people.filter(u=>!members.some(t=>t.user_id===u.id)||orders.some(o=>o.user_id===u.id)||requests.some(r=>r.user_id===u.id)).slice(0,200):[],orders:ops?orders.slice(0,200):[],plans:ops?plans.slice(0,200):[],requests:ops?requests.slice(0,200):[],
 tasks:allTasks.filter(t=>+new Date(t.starts_at)>=Date.now()-7*86400000&&+new Date(t.starts_at)<=Date.now()+61*86400000).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,200).map(t=>({...t,customer:profileOnly({...people.find(p=>p.id===t.customer_id)!,...orders.find(o=>o.id===t.order_id)?.address,phone:orders.find(o=>o.id===t.order_id)?.address.phone||requests.find(r=>r.id===t.request_id)?.phone||people.find(p=>p.id===t.customer_id)!.phone}),provider_name:members.find(p=>p.user_id===t.provider_id)?.name||'Provider'})),
 team:(ops?members:members.filter(t=>t.user_id===id)).map(t=>({...t,email:m.role==='admin'?t.email:undefined})),notes:ops?payloads<WorkNote>('workspace_notes').slice(0,200):[],audit:manages?payloads<AuditEntry>('workspace_audit').slice(0,100):[],
 counts:{customers:ops?people.filter(u=>!members.some(t=>t.user_id===u.id)||orders.some(o=>o.user_id===u.id)||requests.some(r=>r.user_id===u.id)).length:0,orders:ops?orders.length:0,activePlans:ops?plans.filter(p=>!['completed','cancelled'].includes(p.status)).length:0,openRequests:ops?requests.filter(r=>!['resolved','cancelled'].includes(r.status)).length:0,upcomingTasks:allTasks.filter(t=>!['completed','cancelled'].includes(t.status)&&+new Date(t.starts_at)>=Date.now()).length}};
}
export function localWorkspaceAction(id:string,input:WorkspaceAction){
 const m=member(id),db=workspaceDb();if(payloads<AuditEntry>('workspace_audit').filter(a=>(a as AuditEntry&{actor_id:string}).actor_id===id&&+new Date(a.created_at)>Date.now()-60000).length>=60)throw new ApiError('Too many changes. Please wait a minute.',429);
 if(m.role==='provider'&&input.action!=='task_status')throw new ApiError('Permission denied',403);
 let target='',entity='',details:Record<string,unknown>={};const now=new Date().toISOString();
 db.exec('BEGIN IMMEDIATE');try{
 if(input.action==='team'){
  if(m.role!=='admin')throw new ApiError('Permission denied',403);
  const user=customers().find(u=>u.email===input.email);if(!user)throw new ApiError('Account not found. Ask them to create their Truora account first.');
  if(user.id===id)throw new ApiError('Cannot change your own access');
  const previous=team().find(t=>t.user_id===user.id);
  if(previous?.role==='admin'&&previous.active&&(input.role!=='admin'||!input.active)&&team().filter(t=>t.role==='admin'&&t.active).length<=1)throw new ApiError('Cannot remove the final administrator');
  db.prepare('insert into team_members values(?,?,?,?) on conflict(user_id) do update set role=excluded.role,specialty=excluded.specialty,active=excluded.active').run(user.id,input.role,input.specialty,input.active?1:0);
  target=user.id;entity='team';details={from:previous?.role,to:input.role,active:input.active,identity_verified:true};
 }else if(input.action==='note'){
  const valid=input.entityType==='customer'?customers().some(u=>u.id===input.id):input.entityType==='order'?records<Order>('orders').some(r=>r.id===input.id):input.entityType==='recovery'?records<RecoveryPlan>('recovery_plans').some(r=>r.id===input.id):records<ServiceRequest>('requests').some(r=>r.id===input.id);
  if(!valid)throw new ApiError('Unknown record');
  const note:WorkNote={id:randomUUID(),entity_type:input.entityType,entity_id:input.id,body:input.body,created_at:now,author_name:m.name};db.prepare('insert into workspace_notes values(?,?)').run(note.id,JSON.stringify(note));target=input.id;entity=input.entityType;
 }else if(input.action==='task_create'){
  const retry=db.prepare('select id,payload from care_tasks where request_key=?').get(input.requestKey) as {id:string;payload:string}|undefined;if(retry){const saved=JSON.parse(retry.payload) as CareTask;const linked= input.planId?records<RecoveryPlan>('recovery_plans').find(p=>p.id===input.planId)?.order_id:input.orderId||null;if(saved.customer_id!==input.customerId||saved.provider_id!==input.providerId||saved.plan_id!==input.planId||saved.order_id!==linked||saved.request_id!==input.requestId||saved.service_id!==input.serviceId||+new Date(saved.starts_at)!==+new Date(input.startsAt)||saved.duration_minutes!==input.duration||saved.instructions!==input.instructions)throw new ApiError('Task submission already exists with different details. Refresh the schedule.');db.exec('COMMIT');return {ok:true,id:retry.id}}
  const customer=customers().find(c=>c.id===input.customerId),provider=team().find(t=>t.user_id===input.providerId&&t.role==='provider'&&t.active),service=getProduct(input.serviceId);
  if(!customer)throw new ApiError('Customer unavailable');if(!provider)throw new ApiError('Provider unavailable');if(!service||service.kind!=='service')throw new ApiError('Unknown service');
  const expected:Record<string,string>={'service-nursing-visit':'nurse','service-physiotherapy-session':'physiotherapist','service-doctor-tele-follow-up':'doctor','service-dietitian-recovery-plan':'dietitian','service-caregiver-shift-12-hours':'caregiver'};
  if(provider.specialty!==(expected[service.id]||'other'))throw new ApiError('Provider specialty does not match this service');
  const plan=input.planId?records<RecoveryPlan>('recovery_plans').find(p=>p.id===input.planId&&p.user_id===customer.id&&!['completed','cancelled'].includes(p.status)):undefined;
  if(input.planId&&!plan)throw new ApiError('Customer package unavailable');if(input.requestId&&!records<ServiceRequest>('requests').some(r=>r.id===input.requestId&&r.user_id===customer.id&&!['resolved','cancelled'].includes(r.status)))throw new ApiError('Customer request unavailable');
  const linkedOrder=input.orderId?records<Order>('orders').find(o=>o.id===input.orderId&&o.user_id===customer.id&&o.status!=='cancelled'):undefined;
  if(input.orderId&&(!linkedOrder||(plan&&plan.order_id!==input.orderId)))throw new ApiError('Customer order unavailable');
  const start=+new Date(input.startsAt);if(start<Date.now()-300000||start>Date.now()+60*86400000)throw new ApiError('Start time must be within the next 60 days');
  if(payloads<CareTask>('care_tasks').some(t=>t.provider_id===provider.user_id&&!['completed','cancelled'].includes(t.status)&&+new Date(t.starts_at)<start+input.duration*60000&&+new Date(t.starts_at)+t.duration_minutes*60000>start))throw new ApiError('Provider already has a visit during this time');
  const task:CareTask={id:randomUUID(),customer_id:customer.id,provider_id:provider.user_id,service_id:service.id,plan_id:input.planId,order_id:plan?.order_id||input.orderId||null,request_id:input.requestId,title:service.name,starts_at:input.startsAt,duration_minutes:input.duration,instructions:input.instructions,completion_note:'',status:'scheduled',version:1,created_at:now,customer,provider_name:provider.name};
  db.prepare('insert into care_tasks values(?,?,?)').run(task.id,input.requestKey,JSON.stringify(task));target=task.id;entity='task';details={provider_id:provider.user_id,starts_at:input.startsAt,customer_id:customer.id};
 }else if(input.action==='task_status'){
  const task=payloads<CareTask>('care_tasks').find(t=>t.id===input.id);if(!task)throw new ApiError('Unknown task');if(m.role==='provider'&&task.provider_id!==id)throw new ApiError('Permission denied',403);
  if(task.version!==input.version)throw new ApiError('Record changed. Refresh and try again.',409);
  if(['completed','cancelled'].includes(task.status)||(input.status==='cancelled'&&m.role==='provider')||(input.status!=='cancelled'&&taskStatuses.indexOf(input.status)!==taskStatuses.indexOf(task.status)+1))throw new ApiError('Invalid status transition');
  details={from:task.status,to:input.status};task.status=input.status;task.version++;if(task.status==='completed')task.completion_note=input.completionNote;persist('care_tasks',task.id,task);target=task.id;entity='task';
 }else{
  if(input.action==='recovery_status'&&m.role==='staff')throw new ApiError('Permission denied',403);
  const table=input.action==='order_status'?'orders':input.action==='recovery_status'?'recovery_plans':'requests';
  const record=records<Order|ServiceRequest|RecoveryPlan>(table).find(r=>r.id===input.id);if(!record)throw new ApiError('Unknown record');
  if(record.status!==input.expected)throw new ApiError('Record changed. Refresh and try again.',409);
  const stages:readonly string[]=input.action==='order_status'?orderStatuses:input.action==='recovery_status'?recoveryStages.map(s=>s.id):requestStatuses;
  if(['completed','resolved','cancelled'].includes(record.status)||(input.status!=='cancelled'&&stages.indexOf(input.status)!==stages.indexOf(record.status)+1))throw new ApiError('Invalid status transition');
  details={from:record.status,to:input.status};record.status=input.status;
  if('events' in record){record.updated_at=now;record.events.push({status:input.status,at:now,note:'Status updated by the care team.'})}
  const {user_id:_,...payload}=record;persist(table,record.id,payload);target=record.id;entity=input.action==='order_status'?'order':input.action==='recovery_status'?'recovery':'request';
 }
 const audit:AuditEntry&{actor_id:string}={id:randomUUID(),actor_id:id,actor_name:m.name,action:input.action,entity_type:entity,entity_id:target,details,created_at:now};db.prepare('insert into workspace_audit values(?,?)').run(audit.id,JSON.stringify(audit));db.exec('COMMIT');return {ok:true,id:target};
 }catch(e){db.exec('ROLLBACK');throw e}
}
