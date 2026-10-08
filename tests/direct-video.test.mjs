import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {openDatabase} from './pg-test-db.mjs';
import {createAccount,issueSession} from '../server/security.mjs';
import {authorizeVideo,completeVideo,getVideoTask,videoUploadWorker,VIDEO_UPLOAD_ROUTE} from '../server/video-uploads.mjs';
import {CloudBaseStorage,LocalStorage} from '../server/storage/index.mjs';
import {createHttpServer} from '../server/http.mjs';
const mp4=Buffer.concat([Buffer.from('000000186674797069736f6d','hex'),Buffer.alloc(1024)]);
const request={filename:'synthetic.mp4',mime:'video/mp4',size:mp4.length,rights:'隔离合成文件'};
async function fixture(t){
 const db=await openDatabase();t.after(()=>db.close());
 const actor=await createAccount(db,{username:'synthetic',password:randomUUID(),roles:['content']});
 let time=Date.now();const objects=new Map(),removed=[];
 const storage={async signVideoUpload(key){return {url:'https://isolated.invalid/'+key+'?token=synthetic',expiresAt:time+60000};},async videoMetadata(key){const v=objects.get(key);if(!v)throw Error('missing');return {size:v.body.length,mime:v.mime};},async read(key){return Readable.from([objects.get(key).body]);},async delete(key){removed.push(key);objects.delete(key);}};
 const clock=()=>time,worker=()=>videoUploadWorker(db,storage,{clock,onError(){}});
 const grant=()=>authorizeVideo(db,actor,storage,request,clock);
 const submit=id=>completeVideo(db,actor,id,{},clock);
 const status=id=>getVideoTask(db,actor,id,clock);
 const put=(id,body=mp4,mime='video/mp4')=>objects.set(id+'.'+(mime==='video/webm'?'webm':'mp4'),{body,mime});
 return {db,actor,storage,objects,removed,worker,grant,submit,status,put,clock,advance(ms){time+=ms;}};
}
test('Direct video validates MIME, size, metadata and refuses client bucket/key/result',async t=>{
 const f=await fixture(t);
 for(const [patch,code] of [[{mime:'image/png'},'VIDEO_TYPE_INVALID'],[{size:64*1024*1024+1},'VIDEO_SIZE_INVALID'],[{size:NaN},'VIDEO_SIZE_INVALID'],[{size:0},'VIDEO_SIZE_INVALID'],[{objectKey:'../other.mp4'},'UPLOAD_FIELDS_INVALID'],[{bucket:'public'},'UPLOAD_FIELDS_INVALID']])await assert.rejects(authorizeVideo(f.db,f.actor,f.storage,{...request,...patch}),e=>e.code===code);
 assert.equal((await f.db.one('SELECT count(*) n FROM idempotency')).n,0);
 const g=await f.grant();await assert.rejects(completeVideo(f.db,f.actor,g.id,{url:'https://fake.invalid',sha256:'fake'}),e=>e.code==='UPLOAD_FIELDS_INVALID');
 await assert.rejects(f.submit('../other'),e=>e.code==='UPLOAD_ID_INVALID');await assert.rejects(f.submit(randomUUID()),e=>e.status===404);
 const other={...f.actor,id:randomUUID()};await assert.rejects(getVideoTask(f.db,other,g.id),e=>e.status===404);
 const row=await f.db.one('SELECT response FROM idempotency');assert.ok(!JSON.stringify(row).includes('token'));assert.ok(!JSON.stringify(row).includes('uploadUrl'));
 await f.db.execute("UPDATE idempotency SET response=jsonb_set(response::jsonb,'{objectKey}','\"../other.mp4\"')");await assert.rejects(f.submit(g.id),e=>e.code==='UPLOAD_KEY_INVALID');
});
test('Direct video registers server SHA, audit and metadata exactly once across duplicate completion/workers',async t=>{
 const f=await fixture(t),g=await f.grant();f.put(g.id);
 await Promise.all([f.submit(g.id),f.submit(g.id)]);await Promise.all([f.worker().tick(),f.worker().tick()]);
 const s=await f.status(g.id);assert.equal(s.state,'done');assert.equal(s.media.id,g.id);assert.equal(s.media.size,mp4.length);
 const row=await f.db.one('SELECT * FROM media');assert.equal(row.sha256,createHash('sha256').update(mp4).digest('hex'));assert.equal(row.rights,request.rights);
 assert.equal((await f.db.one("SELECT count(*) n FROM audit WHERE action='media.upload'")).n,1);
 f.advance(3600000);assert.deepEqual(await f.submit(g.id),s);await f.worker().tick();assert.equal(f.removed.length,0);
});
test('Direct video absent/malformed/size or MIME mismatch/storage exception never registers media',async t=>{
 const f=await fixture(t);
 for(const kind of ['missing','length','mime','header','read-error']){
  const g=await f.grant();if(kind!=='missing')f.put(g.id,kind==='length'?Buffer.alloc(14):kind==='header'?Buffer.alloc(mp4.length):mp4,kind==='mime'?'video/webm':'video/mp4');
  if(kind==='mime')f.objects.set(g.id+'.mp4',{body:mp4,mime:'video/webm'});
  const original=f.storage.read;if(kind==='read-error')f.storage.read=async()=>{throw Error('private provider details');};
  await f.submit(g.id);await f.worker().tick();f.storage.read=original;
  assert.equal((await f.status(g.id)).state,'failed');assert.ok(!JSON.stringify(await f.status(g.id)).includes('private provider'));
 }
 assert.equal((await f.db.one('SELECT count(*) n FROM media')).n,0);assert.equal((await f.db.one('SELECT count(*) n FROM audit')).n,0);
});
test('Direct video expires; orphan cleanup survives restart, retries deletion and protects registered media',async t=>{
 const f=await fixture(t),g=await f.grant();f.put(g.id);f.advance(600001);
 await assert.rejects(f.submit(g.id),e=>e.code==='UPLOAD_EXPIRED');assert.equal((await f.status(g.id)).state,'expired');
 f.advance(300000);const original=f.storage.delete;f.storage.delete=async()=>{throw Error('offline');};await f.worker().tick();assert.equal(f.objects.size,1);
 f.storage.delete=original;f.advance(300001);await f.worker().tick();assert.equal(f.objects.size,0);assert.equal((await f.db.one('SELECT count(*) n FROM media')).n,0);
 // A late write during a previous in-flight request is caught by another sweep.
 f.put(g.id);f.advance(3600001);await f.worker().tick();assert.equal(f.objects.size,0);
});
test('Direct video task recovers stale lease, accepts WebM and checks revoked permission before registration',async t=>{
 const f=await fixture(t),body=Buffer.concat([Buffer.from('1a45dfa3','hex'),Buffer.alloc(64)]);
 const g=await authorizeVideo(f.db,f.actor,f.storage,{...request,mime:'video/webm',size:body.length},f.clock);f.put(g.id,body,'video/webm');await f.submit(g.id);
 await f.db.execute("UPDATE idempotency SET response=response::jsonb || $1::jsonb WHERE key=$2",[JSON.stringify({lease:'old-process',leaseUntil:f.clock()+300000}),g.id]);
 await f.worker().tick();assert.equal((await f.status(g.id)).state,'verifying');f.advance(300001);await f.worker().tick();assert.equal((await f.status(g.id)).state,'done');
 const second=await f.grant();f.put(second.id);await f.submit(second.id);await f.db.execute('UPDATE accounts SET roles=$1 WHERE id=$2',[JSON.stringify(['reception']),f.actor.id]);await f.worker().tick();assert.equal((await f.status(second.id)).code,'FORBIDDEN');assert.equal((await f.db.one('SELECT count(*) n FROM media')).n,1);
});
test('Direct video audit failure rolls back media and completion; later cleanup compensates',async t=>{
 const f=await fixture(t),g=await f.grant();f.put(g.id);
 await f.db.query("CREATE FUNCTION audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$; CREATE TRIGGER audit_fail BEFORE INSERT ON audit FOR EACH ROW EXECUTE FUNCTION audit_fail()");
 await f.submit(g.id);await f.worker().tick();assert.equal((await f.status(g.id)).state,'failed');assert.equal((await f.db.one('SELECT count(*) n FROM media')).n,0);
 f.advance(900001);await f.worker().tick();assert.equal(f.objects.size,0);
});
test('Direct video sign failure has durable cleanable task and local fallback is local only',async t=>{
 const f=await fixture(t);f.storage.signVideoUpload=async()=>{throw Error('secret-not-to-return');};
 await assert.rejects(f.grant(),e=>e.code==='UPLOAD_SIGN_FAILED'&&!e.message.includes('secret'));
 assert.equal((await f.db.one('SELECT response FROM idempotency')).response.state,'failed');
 assert.deepEqual(await authorizeVideo(f.db,f.actor,new LocalStorage('/tmp/unused-synthetic'),request),{transport:'local-proxy'});
 await assert.rejects(authorizeVideo(f.db,f.actor,{},request),e=>e.code==='DIRECT_UPLOAD_UNAVAILABLE');
});
test('35,722,048-byte synthetic video verifies streaming SHA; exactly 64MiB can authorize',async t=>{
 const f=await fixture(t),body=Buffer.alloc(35_722_048);mp4.copy(body);
 const g=await authorizeVideo(f.db,f.actor,f.storage,{...request,size:body.length},f.clock);f.put(g.id,body);await f.submit(g.id);await f.worker().tick();
 assert.equal((await f.status(g.id)).state,'done');assert.equal((await f.db.one('SELECT sha256 FROM media')).sha256,createHash('sha256').update(body).digest('hex'));
 assert.ok((await authorizeVideo(f.db,f.actor,f.storage,{...request,size:64*1024*1024},f.clock)).uploadUrl);
});
test('Permission revoked while file is being verified prevents final commit',async t=>{
 const f=await fixture(t),g=await f.grant();f.put(g.id);await f.submit(g.id);
 f.storage.read=async()=>{await f.db.execute('UPDATE accounts SET active=false WHERE id=$1',[f.actor.id]);return Readable.from([mp4]);};
 await f.worker().tick();assert.equal((await f.status(g.id)).code,'ACCOUNT_DISABLED');assert.equal((await f.db.one('SELECT count(*) n FROM media')).n,0);
});
test('Direct video HTTP: anonymous 401, reception 403, content/admin allowed, owner and Origin isolated',async t=>{
 const f=await fixture(t),{server,videoWorker}=createHttpServer({db:f.db,storage:f.storage,root:process.cwd(),environment:'staging',adminOrigin:'http://admin.invalid'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const send=(path,data,token,origin='http://admin.invalid')=>fetch(base+'/api/admin/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-HQ-Action':'1',Origin:origin,...(token?{Cookie:'hq_admin='+token}:{})},body:JSON.stringify(data)});
 assert.equal((await send('media/video-uploads',request)).status,401);
 const accounts={content:f.actor};for(const role of ['admin','reception'])accounts[role]=await createAccount(f.db,{username:'synthetic_'+role,password:randomUUID(),roles:[role]});
 const tokens={};for(const [role,a]of Object.entries(accounts))tokens[role]=(await issueSession(f.db,a.id,'admin')).token;
 assert.equal((await send('media/video-uploads',request,tokens.reception)).status,403);
 assert.equal((await send('media/video-uploads',request,tokens.content,'http://wrong.invalid')).status,403);
 for(const role of ['admin','content'])assert.equal((await send('media/video-uploads',request,tokens[role])).status,201);
 const grant=await (await send('media/video-uploads',request,tokens.content)).json();f.put(grant.id);
 assert.equal((await send(`media/video-uploads/${grant.id}/complete`,{},tokens.admin)).status,404);
 assert.equal((await send(`media/video-uploads/${grant.id}/complete`,{},tokens.content)).status,202);
 for(let i=0;i<30;i++){await videoWorker.tick();const r=await fetch(base+`/api/admin/media/video-uploads/${grant.id}`,{headers:{Cookie:'hq_admin='+tokens.content}});if((await r.json()).state==='done')break;await new Promise(r=>setTimeout(r,10));}
 assert.equal((await f.status(grant.id)).state,'done');assert.equal((await send(`media/video-uploads/${grant.id}/complete`,{},tokens.content)).status,200);
});
const jwt=seconds=>'synthetic.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+seconds})).toString('base64url')+'.not-a-real-signature';
test('Official PG signing contract substitute: exact object, no overwrite, server bearer never returned; HEAD metadata',async()=>{
 const calls=[],token=jwt(60);const storage=new CloudBaseStorage({envId:'isolated',bucket:'private',token:'server-only-synthetic',fetchImpl:async(url,o)=>{calls.push({url,o});return o.method==='HEAD'?new Response(null,{headers:{'content-length':'1036','content-type':'video/mp4'}}):Response.json({fullURL:url+'?token='+token,token});}});
 const result=await storage.signVideoUpload('video.mp4');assert.equal(result.url,storage.url('video.mp4','object/upload/sign')+'?token='+token);assert.ok(!JSON.stringify(result).includes('server-only'));assert.equal(calls[0].o.headers['x-upsert'],'false');assert.equal(calls[0].o.headers.Authorization,'Bearer server-only-synthetic');assert.equal(calls[0].o.body,undefined);
 assert.deepEqual(await storage.videoMetadata('video.mp4'),{size:1036,mime:'video/mp4'});await assert.rejects(storage.signVideoUpload('../video.mp4'));
});
test('Official signing response fails closed for expired/long/missing JWT and unexpected object/origin/credentials',async()=>{
 for(const kind of ['expired','long','invalid','wrong-object','wrong-origin','credentials','extra-query','server-token']){
  const storage=new CloudBaseStorage({envId:'isolated',bucket:'private',token:'server-only',fetchImpl:async url=>{let u=new URL(url);u.searchParams.set('token',kind==='expired'?jwt(-1):kind==='long'?jwt(3600):kind==='invalid'?'invalid':kind==='server-token'?'server-only':jwt(60));if(kind==='wrong-object')u.pathname=u.pathname.replace('video','another');if(kind==='wrong-origin')u.hostname='elsewhere.invalid';if(kind==='credentials')u.username='bad';if(kind==='extra-query')u.searchParams.set('key','bad');return Response.json({fullURL:u.href});}});
  await assert.rejects(storage.signVideoUpload('video.mp4'));
 }
});
