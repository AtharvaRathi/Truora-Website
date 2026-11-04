import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
test('Workspace API enforces roles and syncs care visits with customer accounts',async()=>{
 const users=[];let db;
 async function call(path,body,cookie='',origin=base){const r=await fetch(`${base}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 assert.equal((await call('auth/session')).data.backend,'local');
 try{
  assert.equal((await call('workspace')).status,401);
  for(const name of ['Admin','Physio','Customer','Other customer','Staff']){const email=`qa-workspace-${randomUUID()}@example.test`,password='qa-'+randomUUID();const r=await call('auth/signup',{name:'QA '+name,email,password});assert.equal(r.status,200);users.push({name,email,password,cookie:r.cookie,id:r.data.user.id})}
  const [admin,provider,customer,other,staff]=users;
  assert.equal((await call('workspace',undefined,customer.cookie)).status,403);
  db=new DatabaseSync(join(process.cwd(),'.local','truora.sqlite'));
  for(const [u,role,specialty] of [[admin,'admin','other'],[provider,'provider','physiotherapist'],[staff,'staff','other']])db.prepare('insert into team_members values(?,?,?,1)').run(u.id,role,specialty);
  const address={name:'QA Customer',phone:'+910000000000',address:'Demo address - no delivery',city:'Mumbai',pincode:'400001'};
  const placed=await call('orders',{lines:[{productId:'service-physiotherapy-session',mode:'service',quantity:4,days:7,packageSlug:'knee-replacement'},{productId:'wheelchair',mode:'rental',quantity:1,days:14,packageSlug:'knee-replacement'}],address,rentalStart:new Date(Date.now()+86400000).toISOString().slice(0,10),idempotencyKey:randomUUID()},customer.cookie);assert.equal(placed.status,201);
  await call('requests',{kind:'callback',subject:'QA discharge-day coordination',phone:address.phone,preferredTime:'Morning',notes:'Synthetic test request',idempotencyKey:randomUUID()},customer.cookie);
  let workspace=await call('workspace',undefined,admin.cookie);assert.equal(workspace.status,200);assert.equal(workspace.data.member.role,'admin');const plan=workspace.data.plans.find(p=>p.user_id===customer.id);
  const input={action:'task_create',customerId:customer.id,planId:plan.id,requestId:null,serviceId:'service-physiotherapy-session',providerId:provider.id,startsAt:new Date(Date.now()+3600000).toISOString(),duration:60,instructions:'Synthetic visit. No real appointment.',requestKey:randomUUID()};
  const task=await call('workspace',input,admin.cookie);assert.equal(task.status,200);assert.equal((await call('workspace',input,admin.cookie)).data.id,task.data.id);assert.equal((await call('workspace',{...input,duration:45},admin.cookie)).status,400);
  assert.equal((await call('workspace',{...input,requestKey:randomUUID()},admin.cookie)).status,400);
  assert.equal((await call('workspace',{...input,requestKey:randomUUID()},admin.cookie,'https://untrusted.example')).status,403);
  assert.equal((await call('workspace',{action:'recovery_status',id:plan.id,status:'reviewed',expected:'submitted'},staff.cookie)).status,403);
  assert.equal((await call('workspace',{action:'recovery_status',id:plan.id,status:'reviewed',expected:'submitted'},admin.cookie)).status,200);
  const providerView=await call('workspace',undefined,provider.cookie);assert.equal(providerView.data.tasks.length,1);assert.equal(providerView.data.customers.length,0);assert.equal(providerView.data.audit.length,0);
  assert.equal((await call('workspace',{action:'team',email:other.email,role:'admin',specialty:'other',active:true,identityVerified:true},provider.cookie)).status,403);
  assert.equal((await call('workspace',{action:'task_status',id:task.data.id,status:'accepted',version:1,completionNote:''},provider.cookie)).status,200);
  assert.equal((await call('workspace',{action:'task_status',id:task.data.id,status:'in_progress',version:1,completionNote:''},provider.cookie)).status,409);
  const account=await call('account',undefined,customer.cookie);assert.equal(account.data.visits.length,1);assert.equal(account.data.visits[0].status,'accepted');assert.equal(account.data.visits[0].instructions,undefined);assert.equal(account.data.recoveryPlans[0].status,'reviewed');assert.equal((await call('account',undefined,other.cookie)).data.visits.length,0);
  if(process.env.PERSIST_WORKSPACE_QA==='1')writeFileSync(join(process.cwd(),'.local','workspace-qa.json'),JSON.stringify({admin,provider,customer,staff}),{mode:0o600});
 }finally{
  if(db&&process.env.PERSIST_WORKSPACE_QA!=='1'){
   const ids=users.map(u=>u.id);
   for(const id of ids){db.prepare("delete from care_tasks where json_extract(payload,'$.customer_id')=? or json_extract(payload,'$.provider_id')=?").run(id,id);db.prepare("delete from workspace_audit where json_extract(payload,'$.actor_id')=?").run(id);db.prepare('delete from team_members where user_id=?').run(id);for(const table of ['recovery_plans','orders','requests','sessions','resets'])db.prepare(`delete from ${table} where user_id=?`).run(id);db.prepare('delete from users where id=?').run(id)}
  }db?.close();
 }
});
