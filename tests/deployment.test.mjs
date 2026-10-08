import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';import {mkdtempSync,rmSync,readdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {configuration} from '../server/config.mjs';import {CloudBaseStorage,LocalStorage} from '../server/storage/index.mjs';import {upload} from '../server/media.mjs';import {openDatabase} from './pg-test-db.mjs';import {Service} from '../server/service.mjs';import {productPayload} from '../server/sku-seed.mjs';import {fixture} from './admin-business-fixture.mjs';import {createHttpServer} from '../server/http.mjs';import {issueSession} from '../server/security.mjs';
const actor={id:'synthetic',roles:['admin']};
test('Deployment environment fails closed for seed/devAuth/secrets/origin/storage and pool bounds',()=>{
 const dev={APP_ENV:'development',DATABASE_URL:'postgresql://localhost/hq_test_config'};assert.equal(configuration(dev).seed,'none');assert.equal(configuration(dev).devAuth,false);
 for(const patch of [{APP_ENV:'invalid'},{DATABASE_URL:'sqlite:/x'},{PORT:'NaN'},{PGPOOL_MAX:'0'},{APP_ENV:'production',LOCAL_DEV_AUTH:'true'},{APP_ENV:'staging',HQ_SEED_MODE:'development'}])assert.throws(()=>configuration({...dev,...patch}));
 const prod={...dev,APP_ENV:'production',ADMIN_ORIGIN:'https://admin.example.invalid',STORAGE_PROVIDER:'cloudbase',CLOUDBASE_ENV_ID:'test',CLOUDBASE_BUCKET:'private',CLOUDBASE_SERVICE_ROLE_KEY:'synthetic-only'};
 assert.equal(configuration(prod).devAuth,false);for(const patch of [{ADMIN_ORIGIN:'*'},{ADMIN_ORIGIN:'http://admin.example.invalid'},{STORAGE_PROVIDER:'local'},{CLOUDBASE_SERVICE_ROLE_KEY:''}])assert.throws(()=>configuration({...prod,...patch}));
});
test('CloudBase private HTTP contract via explicit fetch substitute: upload, range, metadata, sign and errors (NOT cloud validation)',async()=>{
 const calls=[],storage=new CloudBaseStorage({envId:'isolated',bucket:'private',token:'synthetic-key',fetchImpl:async(url,options)=>{calls.push({url,options});if(options.method==='HEAD')return new Response(null,{headers:{'content-length':'4'}});if(url.includes('/sign/'))return Response.json({signedURL:'/v1/storages/object/sign/private/file.jpg?token=synthetic'});if(options.method==='POST'||options.method==='DELETE')return Response.json({});return new Response('abcd',{status:options.headers.Range?206:200});}});
 await storage.put('file.jpg',Readable.from(['abcd']),{mime:'image/jpeg',size:4});assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-key');assert.equal(calls[0].options.headers['x-upsert'],'false');assert.equal(calls[0].options.redirect,'error');assert.equal((await storage.metadata('file.jpg')).size,4);
 let bytes='';for await(const b of await storage.read('file.jpg',{start:0,end:3}))bytes+=b;assert.equal(bytes,'abcd');assert.ok((await storage.signedUrl('file.jpg',60)).startsWith('https://isolated.api.tcloudbasegateway.com/'));await storage.delete('file.jpg');
 await assert.rejects(storage.read('../escape'));await assert.rejects(storage.signedUrl('file.jpg',301));
 const failed=new CloudBaseStorage({envId:'isolated',bucket:'private',token:'synthetic-key',fetchImpl:async()=>new Response('private detail',{status:403})});await assert.rejects(failed.metadata('file.jpg'),e=>e.message==='云存储操作失败'&&!e.message.includes('private detail'));
 const noRange=new CloudBaseStorage({envId:'isolated',bucket:'private',token:'synthetic-key',fetchImpl:async()=>new Response('abcd')});await assert.rejects(noRange.read('file.jpg',{start:0,end:1}),/范围/);
});
test('Local storage rejects overwrite/path traversal and upload compensates when DB audit transaction fails',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-deploy-media-')),db=await openDatabase();t.after(async()=>{await db.close();rmSync(dir,{recursive:true,force:true});});const storage=new LocalStorage(dir);
 await storage.put('fixed.jpg',Readable.from(['same']));await assert.rejects(storage.put('fixed.jpg',Readable.from(['overwrite'])));let bytes='';for await(const b of await storage.read('fixed.jpg'))bytes+=b;assert.equal(bytes,'same');await assert.rejects(storage.put('../escape',Readable.from(['x'])));
 await db.query("CREATE FUNCTION audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$; CREATE TRIGGER audit_fail BEFORE INSERT ON audit FOR EACH ROW EXECUTE FUNCTION audit_fail()");
 const body=Buffer.from('89504e470d0a1a0a00000000','hex'),req=Readable.from([body]);req.headers={'content-type':'image/png','content-length':String(body.length),'x-file-name':'synthetic.png'};
 await assert.rejects(upload(db,actor,req,storage));assert.equal((await db.one('SELECT count(*) n FROM media')).n,0);assert.deepEqual(readdirSync(dir),['fixed.jpg']);
});
test('PG delete and new consultation serialize references; never orphan history or SKU',async t=>{
 const db=await openDatabase();t.after(()=>db.close());const s=new Service(db);await db.execute('INSERT INTO visitors VALUES($1,NULL,now())',['visitor']);
 for(let i=0;i<10;i++){
  const q=productPayload('race-'+i);q.state='published';const p=await s.saveContent(actor,q);
  const results=await Promise.allSettled([s.createConsultation({id:'visitor'},{contentId:p.id,skuId:p.skus[0].id,contactName:'合成',phone:'13800000000',consent:true,source:'isolated'},randomUUID()),db.transaction(async()=>{await db.lockRows('content',[p.id]);await db.execute("UPDATE content SET state='archived' WHERE id=$1",[p.id]);return s.deleteContent(actor,p.id,p.version);})]);
  const exists=await db.maybeOne('SELECT id FROM content WHERE id=$1',[p.id]),history=await db.many("SELECT id FROM consultations WHERE snapshot->>'id'=$1",[p.id]);
  if(history.length)assert.ok(exists);else if(!exists)assert.equal((await db.one('SELECT count(*) n FROM product_skus WHERE product_id=$1',[p.id])).n,0);
  assert.ok(results.some(r=>r.status==='fulfilled'));
 }
});
test('Production cookies, health and origin protection; concurrent permission revoke cannot authorize later write',async t=>{
 const f=await fixture();t.after(()=>f.close());const {server}=createHttpServer({db:f.db,uploads:join(f.dir,'uploads'),root:f.root,environment:'production',adminOrigin:'https://admin.example.invalid'});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-HQ-Action':'1',Origin:'https://admin.example.invalid'},body:JSON.stringify({username:'qa_admin',password:f.passwords.admin})});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/Secure/);assert.match(login.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await fetch(base+'/api/health')).status,200);assert.equal((await fetch(base+'/api/auth/development',{method:'POST'})).status,403);
 const token=(await issueSession(f.db,f.accounts.content.id,'admin')).token;
 let unblock,locked;const ready=new Promise(r=>locked=r),gate=new Promise(r=>unblock=r);
 const revoke=f.db.transaction(async()=>{await f.db.lockKey('hq:accounts');await f.db.execute('UPDATE accounts SET active=false WHERE id=$1',[f.accounts.content.id]);locked();await gate;});await ready;
 const q=productPayload('must-not-save');q.data.isTest=false;const write=fetch(base+'/api/admin/content',{method:'POST',headers:{'Content-Type':'application/json','X-HQ-Action':'1',Cookie:'hq_admin='+token,Origin:'https://admin.example.invalid'},body:JSON.stringify(q)});unblock();await revoke;assert.equal((await write).status,401);
 assert.equal((await f.db.one("SELECT count(*) n FROM content WHERE name='must-not-save'")).n,0);
 const denied=await fetch(base+'/api/admin/logout',{method:'POST',headers:{'X-HQ-Action':'1',Origin:'https://wrong.example.invalid'}});assert.equal(denied.status,403);
});
test('Production saved content forbids test seed while staging requires synthetic marking',async t=>{
 const db=await openDatabase();t.after(()=>db.close());const prod=new Service(db,{environment:'production'}),stage=new Service(db,{environment:'staging'});
 await assert.rejects(prod.saveContent(actor,productPayload('test')));const q=productPayload('non-test');q.data.isTest=false;const p=await prod.saveContent(actor,q);assert.equal(p.isTest,false);await assert.rejects(stage.saveContent(actor,q));
});
test('Incremental backup reuses verified immutable objects, self-contained restore survives removal of prior set',async t=>{
 const f=await fixture();t.after(()=>f.close());
 const {backupFixture,restoreData,openDatabase:openTest}=await import('./pg-test-db.mjs');const {backupData}=await import('../server/backup.mjs');
 const root=mkdtempSync(join(tmpdir(),'hq-incremental-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const storage=new LocalStorage(join(f.dir,'uploads'));
 const bytes=Buffer.from('89504e470d0a1a0a00000000','hex'),req=Readable.from([bytes]);req.headers={'content-type':'image/png','content-length':String(bytes.length),'x-file-name':'synthetic.png'};const image=await upload(f.db,f.actor,req,storage);
 const first=join(root,'first'),second=join(root,'second');await backupFixture(f.db,join(f.dir,'uploads'),first);
 const manifest=await backupData({db:f.db,connectionString:f.db.connectionString,storage},second,{previous:first});assert.equal(manifest.reusedObjects,1);assert.equal(manifest.counts.media,1);assert.equal(manifest.migrations.length,1);
 rmSync(first,{recursive:true});await restoreData(second,join(root,'restored'));const restored=await openTest(join(root,'restored','fixture.pg'));t.after(()=>restored.close());assert.equal((await restored.one('SELECT id FROM media')).id,image.id);
});
