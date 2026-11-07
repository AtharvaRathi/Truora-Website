import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
test('Mobile/web sync: private cart conflicts, authoritative catalog, safe signals, notifications and deletion ownership',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;
 create schema realtime;create table realtime.messages(topic text);alter table realtime.messages enable row level security;grant usage on schema realtime to anon,authenticated;grant select on realtime.messages to anon,authenticated;
 create function realtime.topic() returns text language sql stable as $$select current_setting('test.topic',true)$$;
 create table public.test_signals(payload jsonb,event text,topic text,private boolean);
 create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$insert into public.test_signals values(payload,event,topic,private)$$;`);
 for(const f of ['001_initial','002_recovery_packages','003_operations_workspace','004_visit_order_context','005_mobile_sync','006_realtime_channels','007_push_delivery','008_deletion_review'])await db.exec(await readFile(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'));
 const alice=randomUUID(),bob=randomUUID();for(const [id,name] of [[alice,'Alice'],[bob,'Bob']])await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,name+'@example.test',JSON.stringify({name})]);
 const as=async id=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])};
 const rpc=async(name,args=[])=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as data`,args)).rows[0].data;
 await as(alice);assert.deepEqual(await rpc('cart_snapshot'),{lines:[],version:0});
 const lines=[{productId:'bp-machine',mode:'purchase',quantity:1,days:7}];const saved=await rpc('save_cart',[JSON.stringify(lines),0]);assert.equal(saved.version,1);assert.deepEqual(saved.lines,lines);
 await assert.rejects(rpc('save_cart',[JSON.stringify([]),0]),/Cart changed/);
 await assert.rejects(rpc('save_cart',[JSON.stringify([{...lines[0],quantity:1.5}]),1]),/Invalid cart/);
 await assert.rejects(rpc('save_cart',[JSON.stringify([{...lines[0],mode:'service'}]),1]),/Unavailable cart mode/);
 await assert.rejects(rpc('save_cart',[JSON.stringify([{...lines[0],packageSlug:'fake'}]),1]),/Unknown recovery/);
 await assert.rejects(db.query('select * from public.account_carts'),/permission denied/);
 await as(bob);assert.deepEqual(await rpc('cart_snapshot'),{lines:[],version:0});
 await rpc('register_push_device',['ExpoPushToken[test-token]','android',false]);
 await rpc('request_account_deletion');await rpc('request_account_deletion');await assert.rejects(rpc('workspace_deletion_requests'),/Permission denied/);
 await as(alice);const catalog=await rpc('catalog_snapshot');assert.equal(catalog.items.length,88);assert.equal(catalog.packages.length,10);
 const address={name:'Alice',phone:'+910000000000',address:'Synthetic address',city:'Mumbai',pincode:'400001'};
 await rpc('place_demo_order',[JSON.stringify(lines),JSON.stringify(address),null,randomUUID()]);
 const notifications=await db.query('select * from public.app_notifications');assert.ok(notifications.rows.length);assert.ok(notifications.rows.every(n=>n.user_id===alice&&!n.body.includes('Alice')));
 await as(bob);assert.equal((await db.query('select * from public.app_notifications')).rows.length,0);
 await db.exec('reset role');assert.equal((await db.query('select * from public.account_deletion_requests')).rows.length,1);
 const signals=(await db.query('select * from public.test_signals')).rows;assert.ok(signals.length);assert.ok(signals.every(s=>s.private&&JSON.stringify(s.payload)==='{"refresh":true}'));
 await db.query("update public.products set price=200000 where id='bp-machine'");await as(alice);assert.equal((await rpc('catalog_snapshot')).items.find(p=>p.id==='bp-machine').price,200000);
 await db.exec('set role anon');await assert.rejects(rpc('save_cart',[JSON.stringify(lines),0]),/permission denied/);await assert.rejects(rpc('request_account_deletion'),/permission denied/);
 assert.equal((await rpc('catalog_snapshot')).items.length,88);
 }finally{await db.close()}
});
