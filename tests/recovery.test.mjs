import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
test('Phase 1 packages reconcile; checkout is atomic, priced by database, private and status controlled',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;`);
  for(const file of ['001_initial.sql','002_recovery_packages.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const data=JSON.parse(await readFile(new URL('../lib/data/phase-one.json',import.meta.url),'utf8'));
  const alice=randomUUID(),bob=randomUUID();await db.query(`insert into auth.users values($1,'{"name":"Alice"}'),($2,'{"name":"Bob"}')`,[alice,bob]);
  await db.exec('set role authenticated');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[alice]);
  const address={name:'QA Example',phone:'+910000000000',address:'Demo address - no delivery',city:'Mumbai',pincode:'400001'};
  let first;
  for(const pack of data.packages){
   const lines=pack.lines.map(l=>({...l,packageSlug:pack.slug,unitPrice:1}));
   const args=[JSON.stringify(lines),JSON.stringify(address),'2099-01-01',randomUUID()];
   const order=(await db.query('select public.place_demo_order($1,$2,$3,$4) as result',args)).rows[0].result;
   assert.equal(order.total,pack.price*100,pack.slug);assert.equal(order.deposit,0);assert.equal(order.items[0].packageSlug,pack.slug);
   assert.equal((await db.query('select public.place_demo_order($1,$2,$3,$4) as result',args)).rows[0].result.id,order.id);
   first??=order;
  }
  const plans=(await db.query('select * from public.recovery_plans')).rows;assert.equal(plans.length,10);assert.ok(plans.every(p=>p.status==='submitted'&&p.events.length===1));
  const custom=[{productId:'wheelchair',mode:'purchase',days:7,quantity:1,packageSlug:'knee-replacement'},{productId:'service-physiotherapy-session',mode:'service',quantity:3,days:7,packageSlug:'knee-replacement'},{productId:'cpm-machine',mode:'rental',quantity:1,days:11,packageSlug:'knee-replacement'}];
  const customized=(await db.query('select public.place_demo_order($1,$2,$3,$4) as result',[JSON.stringify(custom),JSON.stringify(address),'2099-01-01',randomUUID()])).rows[0].result;assert.equal(customized.total,1230000);
  for(const change of [{mode:'service'},{productId:'not-real'},{packageSlug:'not-real'},{quantity:61},{days:91}])await assert.rejects(db.query('select public.place_demo_order($1,$2,$3,$4)',[JSON.stringify([{...custom[0],...change}]),JSON.stringify(address),'2099-01-01',randomUUID()]));
  assert.equal((await db.query('select * from public.orders')).rows.length,11,'Failed carts create no records');
  await assert.rejects(db.query("update public.recovery_plans set status='completed'"),/permission denied/);
  await assert.rejects(db.query("update public.recovery_templates set weeks=99"),/permission denied/);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[bob]);assert.equal((await db.query('select * from public.recovery_plans')).rows.length,0);assert.equal((await db.query('select * from public.orders')).rows.length,0);
  await db.exec('reset role');
  await assert.rejects(db.query("update public.recovery_plans set status='completed' where id=$1",[plans[0].id]),/Invalid recovery status transition/);
  await db.query("update public.recovery_plans set status='reviewed' where id=$1",[plans[0].id]);
  const reviewed=(await db.query('select * from public.recovery_plans where id=$1',[plans[0].id])).rows[0];assert.equal(reviewed.events.length,2);assert.equal(reviewed.events[1].status,'reviewed');
  await db.exec('set role anon');await assert.rejects(db.query('select * from public.recovery_plans'),/permission denied/);assert.equal((await db.query('select * from public.recovery_templates')).rows.length,10);
 }finally{await db.close()}
});
