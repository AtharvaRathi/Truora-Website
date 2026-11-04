import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
test('Local API: shared accounts, protected orders, checkout validation, requests and recovery',async()=>{
 const emails=[];
 async function call(path,body,cookie='',origin=base){const response=await fetch(`${base}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers}}
 const session=await call('auth/session');assert.equal(session.data.backend,'local','Run against the local development backend only');
 try{
  assert.equal((await call('account')).status,401);
  assert.equal((await call('auth/signup',{name:'Test',email:'bad',password:'short'})).status,400);
  const email=`qa-${randomUUID()}@example.test`;emails.push(email);
  const signup=await call('auth/signup',{name:'Alice Test',email,password:'test-password-123'});assert.equal(signup.status,200);assert.ok(signup.headers.get('set-cookie').includes('HttpOnly'));const cookie=signup.cookie;
  assert.equal((await call('auth/session',undefined,cookie)).data.user.email,email);
  const profile={name:'Alice Updated',phone:'+917798200771',address:'10 Test Street',city:'Mumbai',pincode:'400001'};
  assert.equal((await call('account/profile',profile,cookie)).data.user.name,'Alice Updated');
  const input={lines:[{productId:'bp-machine',mode:'purchase',quantity:1,days:7},{productId:'wheelchair',mode:'rental',quantity:1,days:7}],address:profile,rentalStart:'2099-01-01',idempotencyKey:randomUUID()};
  assert.equal((await call('orders',input)).status,401);
  assert.equal((await call('orders',input,cookie,'https://untrusted.example')).status,403);
  assert.equal((await call('orders',{...input,total:1},cookie)).status,400);
  assert.equal((await call('orders',{...input,lines:[{...input.lines[0],quantity:-1}]},cookie)).status,400);
  assert.equal((await call('orders',{...input,rentalStart:'2000-01-01'},cookie)).status,400);
  const placed=await call('orders',input,cookie);assert.equal(placed.status,201);assert.equal(placed.data.order.total,235000);assert.equal(placed.data.order.deposit,0);
  const retry=await call('orders',input,cookie);assert.equal(retry.data.order.id,placed.data.order.id);
  const request={kind:'service',subject:'Physiotherapy',phone:profile.phone,preferredTime:'Morning',notes:'General test request',idempotencyKey:randomUUID()};assert.equal((await call('requests',request,cookie)).status,201);assert.equal((await call('requests',request,cookie)).status,201);
  const packageInput={...input,idempotencyKey:randomUUID(),lines:[{productId:'wheelchair',mode:'rental',quantity:1,days:14,packageSlug:'knee-replacement'},{productId:'service-physiotherapy-session',mode:'service',quantity:4,days:7,packageSlug:'knee-replacement'}]};
  const packageOrder=await call('orders',packageInput,cookie);assert.equal(packageOrder.status,201);assert.equal(packageOrder.data.order.total,330000);
  assert.equal((await call('orders',packageInput,cookie)).data.order.id,packageOrder.data.order.id);
  const account=await call('account',undefined,cookie);assert.equal(account.data.orders.length,2);assert.equal(account.data.requests.length,1);assert.equal(account.data.recoveryPlans.length,1);assert.equal(account.data.recoveryPlans[0].status,'submitted');assert.equal(account.headers.get('cache-control'),'no-store');
  const bobEmail=`qa-${randomUUID()}@example.test`;emails.push(bobEmail);const bob=await call('auth/signup',{name:'Bob Test',email:bobEmail,password:'test-password-456'});assert.equal((await call('account',undefined,bob.cookie)).data.orders.length,0);
  assert.equal((await call('auth/login',{email,password:'incorrect'})).status,400);
  const reset=await call('auth/forgot',{email});assert.ok(reset.data.developmentResetUrl);const token=new URL(reset.data.developmentResetUrl,base).searchParams.get('token');
  assert.equal((await call('auth/reset',{token,password:'new-test-password-123'})).status,200);assert.equal((await call('auth/session',undefined,cookie)).data.user,null);
  assert.equal((await call('auth/reset',{token,password:'new-test-password-456'})).status,400);
  const login=await call('auth/login',{email,password:'new-test-password-123'});assert.equal(login.status,200);assert.equal((await call('account',undefined,login.cookie)).data.orders.length,2);
  assert.equal((await call('auth/logout',{},login.cookie)).status,200);assert.equal((await call('account',undefined,login.cookie)).status,401);
 }finally{
  // Remove only the synthetic accounts created by this test. Leave review accounts untouched.
  if(existsSync(join(process.cwd(),'.local','truora.sqlite'))){
  const db=new DatabaseSync(join(process.cwd(),'.local','truora.sqlite'));db.exec('PRAGMA foreign_keys=ON');
  for(const email of emails){const row=db.prepare('select id from users where email=?').get(email);if(row){for(const table of ['recovery_plans','orders','requests','sessions','resets'])db.prepare(`delete from ${table} where user_id=?`).run(row.id);db.prepare('delete from users where id=?').run(row.id)}}db.close();}
 }
});
