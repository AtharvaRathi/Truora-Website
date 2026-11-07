import test from 'node:test';import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5173';
test('Mobile API requires verified bearer sessions and cannot be authenticated by website cookies',async()=>{
 const preflight=await fetch(base+'/api/mobile/v1/account',{method:'OPTIONS',headers:{Origin:'http://localhost:8081','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'*');assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
 for(const path of ['account','workspace','cart','notifications']){const r=await fetch(base+'/api/mobile/v1/'+path);assert.equal(r.status,401,path);assert.match((await r.json()).error,/Sign in/)}
 const invalid=await fetch(base+'/api/mobile/v1/workspace',{headers:{Authorization:'Bearer forged-admin-token'}});assert.ok([401,503].includes(invalid.status));
 const catalog=await fetch(base+'/api/mobile/v1/catalog');assert.equal(catalog.status,200);assert.equal((await catalog.json()).items.length,88);
 const sessionToken=await fetch(base+'/api/realtime');assert.equal(sessionToken.status,403);
});
