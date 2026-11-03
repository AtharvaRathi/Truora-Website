import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('Supabase migration: authoritative pricing, atomic orders, idempotency and owner-only access', async () => {
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/001_initial.sql',import.meta.url),'utf8'));
  const alice=randomUUID(),bob=randomUUID();
  await db.query(`insert into auth.users values($1,'{"name":"Alice"}'),($2,'{"name":"Bob"}')`,[alice,bob]);
  await db.exec('set role authenticated');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[alice]);
  const profiles=await db.query('select * from public.profiles');assert.equal(profiles.rows.length,1);assert.equal(profiles.rows[0].id,alice);
  const address={name:'Alice Example',phone:'+917798200771',address:'10 Test Street',city:'Mumbai',pincode:'400001'};
  const lines=[{productId:'bp-machine',mode:'purchase',quantity:2,days:7,unitPrice:1},{productId:'wheelchair',mode:'rental',quantity:1,days:30}];
  const key=randomUUID();const args=[JSON.stringify(lines),JSON.stringify(address),'2099-01-01',key];
  const placed=await db.query('select public.place_demo_order($1,$2,$3,$4) as order_data',args);
  const order=placed.rows[0].order_data;assert.equal(order.subtotal,509700);assert.equal(order.deposit,200000);assert.equal(order.total,709700);assert.equal(order.payment_status,'not_charged');assert.equal(order.items[0].unitPrice,179900);
  const retry=await db.query('select public.place_demo_order($1,$2,$3,$4) as order_data',args);assert.equal(retry.rows[0].order_data.id,order.id);assert.equal((await db.query('select * from public.orders')).rows.length,1);
  const badLines=[{productId:'bp-machine',mode:'purchase',quantity:1,days:7},{productId:'not-real',mode:'purchase',quantity:1,days:7}];
  await assert.rejects(db.query('select public.place_demo_order($1,$2,null,$3)',[JSON.stringify(badLines),JSON.stringify(address),randomUUID()]),/Product unavailable/);
  assert.equal((await db.query('select * from public.orders')).rows.length,1,'Failed cart is atomic');
  for(const invalid of [{...lines[0],quantity:0},{...lines[0],mode:null},{...lines[0],days:2}]) await assert.rejects(db.query('select public.place_demo_order($1,$2,null,$3)',[JSON.stringify([invalid]),JSON.stringify(address),randomUUID()]));
  await assert.rejects(db.query('select public.place_demo_order($1,$2,$3,$4)',[JSON.stringify([lines[1]]),JSON.stringify(address),'2000-01-01',randomUUID()]),/Invalid rental date/);
  await assert.rejects(db.query('update public.products set price=1 where id=$1',['bp-machine']),/permission denied/);
  await assert.rejects(db.query(`update public.orders set total=1`),/permission denied/);
  const requestKey=randomUUID();const request=await db.query(`select public.submit_demo_request('callback','General question','+917798200771',null,'Morning','Test request',$1) as request_data`,[requestKey]);assert.equal(request.rows[0].request_data.kind,'callback');
  const repeated=await db.query(`select public.submit_demo_request('callback','General question','+917798200771',null,'Morning','Test request',$1) as request_data`,[requestKey]);assert.equal(repeated.rows[0].request_data.id,request.rows[0].request_data.id);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[bob]);
  assert.equal((await db.query('select * from public.orders')).rows.length,0);assert.equal((await db.query('select * from public.service_requests')).rows.length,0);
  await db.query('update public.profiles set name=$1 where id=$2',['Changed',alice]);assert.equal((await db.query('select * from public.profiles')).rows[0].name,'Bob');
  await db.exec('set role anon');await db.query(`select set_config('request.jwt.claim.sub','',false)`);
  await assert.rejects(db.query('select * from public.orders'),/permission denied/);
  await assert.rejects(db.query('select public.place_demo_order($1,$2,null,$3)',[JSON.stringify(lines),JSON.stringify(address),randomUUID()]),/permission denied/);
  assert.equal((await db.query('select * from public.products')).rows.length,2);
 } finally {await db.close()}
});
