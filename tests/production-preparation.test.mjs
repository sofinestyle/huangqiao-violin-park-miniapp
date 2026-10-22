import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {openDatabase} from './pg-test-db.mjs';
import {createAccount} from '../server/security.mjs';
import {Service} from '../server/service.mjs';
import {createHttpServer} from '../server/http.mjs';
import {contentTestFlag,contentForSave} from '../admin/src/content-environment.mjs';
import {entryFetch} from './http-entry-client.mjs';

test('Admin derives test marking from authenticated server environment and never promotes old content',()=>{
 for(const env of ['development','staging','production']){
  const draft={name:'synthetic',images:[],isTest:contentTestFlag(env)};
  assert.equal(draft.isTest,env!=='production');assert.deepEqual(contentForSave(draft,env),draft);
 }
 assert.throws(()=>contentTestFlag(undefined));assert.throws(()=>contentTestFlag('unknown'));
 const legacy={name:'synthetic',isTest:true};assert.throws(()=>contentForSave(legacy,'production'));assert.equal(legacy.isTest,true);
 assert.throws(()=>contentForSave({isTest:false},'staging'));assert.throws(()=>contentForSave({},'production'));
});

test('Production canonical API blocks ordinary old clients before writes; preserves auth, CSRF and explicit content marking',async t=>{
 const db=await openDatabase(),password=randomUUID();
 await createAccount(db,{username:'production_qa',password,roles:['admin']});
 const origin='https://admin.yorray.com',host='admin.yorray.com';
 const {server}=createHttpServer({db,root:fileURLToPath(new URL('../',import.meta.url)),environment:'production',adminOrigin:origin});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
 const base='http://127.0.0.1:'+server.address().port;
 const call=(path,options={})=>entryFetch(base+path,{...options,headers:{Host:host,...options.headers}});
 assert.equal((await fetch(base+'/api/health')).status,200);
 const counts=()=>db.one('SELECT (SELECT count(*) FROM content) AS content,(SELECT count(*) FROM visitors) AS visitors,(SELECT count(*) FROM sessions) AS sessions,(SELECT count(*) FROM consultations) AS consultations,(SELECT count(*) FROM bookings) AS bookings');
 const before=await counts();
 for(const oldHost of ['old.ap-shanghai.app.tcloudbase.com','localhost:8787'])for(const path of ['/api/auth/wechat','/api/visitor/bookings','/api/visitor/consultations','/api/admin/login']){
  const r=await call(path,{method:'POST',headers:{Host:oldHost,'X-Forwarded-Host':host,Forwarded:'host='+host,'X-Mini-Environment':'production','Content-Type':'application/json'},body:'{}'});
  assert.equal(r.status,403);assert.equal((await r.json()).code,'PRODUCTION_ENTRY_REQUIRED');
 }
 assert.deepEqual(await counts(),before);
 assert.equal((await fetch(base+'/api/public/content')).status,403);
 assert.equal((await call('/api/public/content')).status,200);
 const login=await call('/api/admin/login',{method:'POST',headers:{Origin:origin,'X-HQ-Action':'1','Content-Type':'application/json'},body:JSON.stringify({username:'production_qa',password})});
 assert.equal(login.status,200);assert.equal((await login.json()).environment,'production');
 const cookie=login.headers.get('set-cookie');for(const flag of ['Secure','HttpOnly','SameSite=Strict','Path=/'])assert.ok(cookie.includes(flag));
 const headers={Cookie:cookie.split(';')[0],Origin:origin,'X-HQ-Action':'1','Content-Type':'application/json'};
 assert.equal((await (await call('/api/admin/me',{headers})).json()).environment,'production');
 const payload={kind:'spot',name:'isolated production content',state:'draft',data:{images:[],isTest:false}};
 const write=(data,h=headers)=>call('/api/admin/content',{method:'POST',headers:h,body:JSON.stringify(data)});
 assert.equal((await write(payload,{...headers,Origin:'https://foreign.invalid'})).status,403);
 const noAction={...headers};delete noAction['X-HQ-Action'];assert.equal((await write(payload,noAction)).status,403);
 const noCookie={...headers};delete noCookie.Cookie;assert.equal((await write(payload,noCookie)).status,401);
 assert.equal((await write({...payload,data:{...payload.data,isTest:true}})).status,400);
 const savedResponse=await write(payload);assert.equal(savedResponse.status,201);const saved=await savedResponse.json();assert.equal(saved.isTest,false);
 const update=await call('/api/admin/content/'+saved.id,{method:'PUT',headers,body:JSON.stringify({...payload,version:saved.version,name:'updated formal content'})});assert.equal(update.status,200);
 const stage=new Service(db,{environment:'staging'}),actor={id:'synthetic',roles:['admin']};
 const legacy=await stage.saveContent(actor,{...payload,name:'legacy test content',data:{images:[],isTest:true}});
 const prior=await db.one('SELECT * FROM content WHERE id=$1',[legacy.id]);
 const denied=await call('/api/admin/content/'+legacy.id,{method:'PUT',headers,body:JSON.stringify({...payload,version:legacy.version})});assert.equal(denied.status,400);
 assert.deepEqual(await db.one('SELECT * FROM content WHERE id=$1',[legacy.id]),prior);
});

test('Staging keeps existing entry behavior and reports authenticated environment',async t=>{
 const db=await openDatabase(),password=randomUUID();await createAccount(db,{username:'stage_qa',password,roles:['content']});
 const origin='https://admin.yorray.com',{server}=createHttpServer({db,root:fileURLToPath(new URL('../',import.meta.url)),environment:'staging',adminOrigin:origin});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
 const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/api/public/content')).status,200);
 const r=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-HQ-Action':'1',Origin:origin},body:JSON.stringify({username:'stage_qa',password})});assert.equal(r.status,200);assert.equal((await r.json()).environment,'staging');
});
