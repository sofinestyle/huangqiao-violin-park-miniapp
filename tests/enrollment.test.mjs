import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {Worker} from 'node:worker_threads';
import {openDatabase} from '../server/db.mjs';
import {seed} from '../server/seed.mjs';
import {Service} from '../server/service.mjs';
import {createAccount,issueSession} from '../server/security.mjs';
import {createHttpServer} from '../server/http.mjs';
import {backupData,restoreData} from '../server/backup.mjs';
function fixture(t,path=':memory:') {
  const db=openDatabase(path);seed(db);t.after(()=>db.close());const service=new Service(db);
  const admin=createAccount(db,{username:'enroll_admin',password:randomUUID()+randomUUID(),roles:['admin']});
  const reception=createAccount(db,{username:'enroll_staff',password:randomUUID()+randomUUID(),roles:['reception']});
  const visitor=()=>{const id=randomUUID();db.prepare('INSERT INTO visitors VALUES (?,NULL,?)').run(id,new Date().toISOString());return {id};};
  return {db,service,admin,reception,a:visitor(),b:visitor()};
}
const input=(extra={})=>({date:'2099-11-01',start:'09:00',end:'11:00',capacity:6,externalCount:4,packageIds:['package-1'],note:'内部接待备注不公开',enrollment:{state:'published',title:'虚拟成团活动',packageId:'package-1',meetingPoint:'隔离验证集合点',description:'机制验证',feeNote:'费用待联系确认',registrationNote:'隔离样例，不作接待'},...extra});
const save=(f,extra={})=>f.service.saveSlot(f.admin,input(extra));
const update=(f,s,extra={})=>f.service.saveSlot(f.admin,{...s,externalCount:s.external_count,packageIds:s.package_ids,...extra},s.id);
const request=(s,extra={})=>({enrollmentId:s.id,slotId:s.id,packageId:'package-1',date:s.date,adults:1,children:0,contactName:'虚拟报名访客',phone:'13800000000',note:'仅隔离验证',consent:true,...extra});
const apply=(f,s,owner=f.a,extra={},key=randomUUID())=>f.service.createBooking(owner,request(s,extra),key);
const confirm=(f,b,s,actor=f.admin)=>f.service.handleBooking(actor,b.id,{action:'confirm',version:b.version || 1,slotId:s.id,assignee:actor.id,note:'隔离测试已联系并确认'});
const fault=(fn,code)=>assert.throws(fn,e=>code?e.code===code:e.status>=400);

test('旧场次迁移保留原值，默认不作为成团活动发布，重复打开不重做迁移',t=>{
  const dir=mkdtempSync(join(tmpdir(),'hq-enroll-migrate-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'old.sqlite');
  const old=new DatabaseSync(path);old.exec(`CREATE TABLE slots(id TEXT PRIMARY KEY,date TEXT NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,capacity INTEGER NOT NULL,package_ids TEXT NOT NULL,paused INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);`);
  old.prepare('INSERT INTO slots VALUES (?,?,?,?,?,?,?,?,?)').run('old-slot','2099-11-01','09:00','11:00',9,'["package-1"]',0,'原接待备注',7);old.close();
  let db=openDatabase(path);const slot=new Service(db).slots()[0];assert.equal(slot.id,'old-slot');assert.equal(slot.version,7);assert.equal(slot.capacity,9);assert.equal(slot.note,'原接待备注');assert.equal(slot.external_count,0);assert.equal(slot.enrollment.state,'draft');assert.deepEqual(new Service(db).enrollments(),[]);db.close();
  db=openDatabase(path);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='schema.slot-enrollment.migrate'").get().n,1);db.close();
});
test('发布需实际成团人数、公开集合地点和已发布套餐；接待权限与公开字段隔离',t=>{
  const f=fixture(t);fault(()=>f.service.saveSlot({id:'content',roles:['content']},input()),'FORBIDDEN');
  fault(()=>save(f,{externalCount:0}));fault(()=>save(f,{externalCount:7}),'CAPACITY_FULL');fault(()=>save(f,{externalCount:-1}));
  fault(()=>save(f,{enrollment:{...input().enrollment,meetingPoint:''}}));fault(()=>save(f,{enrollment:{...input().enrollment,packageId:'package-2'}}));
  const draft=save(f,{enrollment:{state:'draft'}});assert.equal(f.service.enrollments().length,0);
  const s=save(f);const e=f.service.enrollment(s.id);assert.equal(e.remaining,2);assert.equal(e.canApply,true);assert.equal(e.packageName,f.service.content('package-1').name);
  for(const key of ['note','external_count','contactName','phone','assignee','package_ids'])assert.equal(Object.hasOwn(e,key),false);
  const pkg=f.service.content('package-1');f.service.saveContent(f.admin,{version:pkg.version,name:pkg.name,state:'archived',data:pkg},pkg.id);assert.deepEqual(f.service.enrollments(),[]);fault(()=>f.service.enrollment(s.id),'ENROLLMENT_UNAVAILABLE');assert.equal(draft.enrollment.state,'draft');
});
test('报名真实保存为待确认，重试幂等，历史活动快照与本人归属保留',t=>{
  const f=fixture(t),s=save(f),key=randomUUID();const b=apply(f,s,f.a,{},key);assert.deepEqual(apply(f,s,f.a,{},key),b);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n,1);
  assert.equal(b.state,'pending');assert.equal(f.service.slots()[0].remaining,2);assert.equal(f.service.slots()[0].confirmed_count,0);
  const record=f.service.getBooking(b.id,f.a);assert.equal(record.request.enrollment.title,'虚拟成团活动');assert.equal(Object.hasOwn(record,'owner'),false);fault(()=>f.service.getBooking(b.id,f.b),'NOT_FOUND');
  const edited=update(f,s,{enrollment:{...s.enrollment,title:'后续更名',feeNote:'后续维护费用说明'}});assert.equal(f.service.enrollment(s.id).title,'后续更名');assert.equal(f.service.getBooking(b.id,f.a).request.enrollment.feeNote,'费用待联系确认');assert.equal(f.service.getBooking(b.id,f.a).request.enrollment.title,'虚拟成团活动');
  fault(()=>update(f,edited,{date:'2099-11-02'}),'SLOT_HAS_BOOKINGS');fault(()=>update(f,edited,{enrollment:{...edited.enrollment,packageId:'package-2'}}),'SLOT_HAS_BOOKINGS');
  assert.equal(f.service.adminRecords(f.admin,'bookings',{enrollment:'1',q:'虚拟成团'}).length,1);
});
test('服务端拒绝篡改套餐、日期、时段、团体模式和超出当前可确认人数的报名',t=>{
  const f=fixture(t),s=save(f);for(const extra of [{packageId:'package-2'},{date:'2099-11-02'},{slotId:randomUUID()},{group:true,team:'虚拟团队',total:1}])fault(()=>apply(f,s,f.a,extra));
  fault(()=>apply(f,s,f.a,{adults:3}),'CAPACITY_FULL');assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n,0);
  const archived=update(f,s,{enrollment:{...s.enrollment,state:'archived'}});fault(()=>apply(f,archived),'ENROLLMENT_UNAVAILABLE');
});
test('人工确认计入系统外人数，满额、暂停、取消与场次绑定保持一致',t=>{
  const f=fixture(t),s=save(f,{capacity:5});const one=apply(f,s),two=apply(f,s,f.b);const other=save(f,{enrollment:{state:'draft'},date:'2099-11-02'});
  fault(()=>confirm(f,one,other),'ENROLLMENT_SLOT_MISMATCH');const confirmed=confirm(f,one,s);assert.equal(confirmed.state,'confirmed');assert.equal(f.service.enrollment(s.id).remaining,0);assert.equal(f.service.enrollment(s.id).canApply,false);assert.equal(f.service.enrollment(s.id).availabilityLabel,'已满员');fault(()=>confirm(f,two,s),'CAPACITY_FULL');
  const current=f.service.slots().find(x=>x.id===s.id);fault(()=>update(f,current,{externalCount:5}),'CAPACITY_FULL');
  f.service.handleBooking(f.admin,one.id,{action:'cancel',version:confirmed.version,note:'隔离取消验证'});assert.equal(f.service.enrollment(s.id).remaining,1);
  const paused=update(f,current,{paused:true});assert.equal(f.service.enrollments().some(e=>e.id===s.id),false);fault(()=>confirm(f,two,paused),'SLOT_UNAVAILABLE');
  const resumed=update(f,paused,{paused:false,enrollment:{...paused.enrollment,state:'archived'}});assert.equal(f.service.enrollments().some(e=>e.id===s.id),false);assert.equal(confirm(f,two,resumed).state,'confirmed');assert.equal(f.service.slots().find(x=>x.id===s.id).occupied_count,5);
});
test('两工作人员并发确认跟团报名，系统外人数也受同一事务保护',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'hq-enroll-concurrency-'));const path=join(dir,'huangqiao.sqlite');t.after(()=>rmSync(dir,{recursive:true,force:true}));const f=fixture(t,path),s=save(f,{capacity:5}),one=apply(f,s),two=apply(f,s,f.b);
  const barrier=new SharedArrayBuffer(4);let ready=0;
  const spawn=(bookingId,actor)=>new Promise((resolveResult,reject)=>{
    const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {openDatabase}=await import(workerData.dbModule);const {Service}=await import(workerData.serviceModule);const db=openDatabase(workerData.path);parentPort.postMessage({ready:true});Atomics.wait(new Int32Array(workerData.barrier),0,0);try{const r=new Service(db).handleBooking(workerData.actor,workerData.bookingId,{action:'confirm',version:1,slotId:workerData.slotId,note:'并发跟团确认',assignee:workerData.actor.id});parentPort.postMessage({state:r.state});}catch(e){parentPort.postMessage({code:e.code});}finally{db.close();}})();`,{eval:true,workerData:{path,barrier,actor,bookingId,slotId:s.id,dbModule:new URL('../server/db.mjs',import.meta.url).href,serviceModule:new URL('../server/service.mjs',import.meta.url).href}});
    worker.on('message',m=>{if(m.ready){ready++;if(ready===2){Atomics.store(new Int32Array(barrier),0,1);Atomics.notify(new Int32Array(barrier),0,2);}}else resolveResult(m);});worker.on('error',reject);
  });
  const results=await Promise.all([spawn(one.id,f.admin),spawn(two.id,f.reception)]);assert.equal(results.filter(r=>r.state==='confirmed').length,1);assert.equal(results.filter(r=>r.code==='CAPACITY_FULL').length,1);assert.equal(f.service.slots()[0].occupied_count,5);
});
test('HTTP匿名查看活动、游客身份提交、后台确认、停报与本人查询闭环',async t=>{
  const f=fixture(t),s=save(f);const {server}=createHttpServer({db:f.db,root:resolve('.'),uploads:join(tmpdir(),'unused-enrollment-media')});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
  const token=issueSession(f.db,f.a.id,'visitor'),staff=issueSession(f.db,f.admin.id,'admin');
  let r=await fetch(base+'/api/public/slots');assert.equal(Object.hasOwn((await r.json())[0],'note'),false);r=await fetch(base+'/api/public/enrollments');assert.equal(r.status,200);assert.equal((await r.json()).length,1);r=await fetch(base+'/api/public/enrollments/'+s.id);assert.equal((await r.json()).remaining,2);
  r=await fetch(base+'/api/visitor/bookings',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(request(s))});assert.equal(r.status,401);
  r=await fetch(base+'/api/visitor/bookings',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token.token,'Idempotency-Key':randomUUID()},body:JSON.stringify(request(s))});assert.equal(r.status,201);const b=await r.json();assert.equal(b.state,'pending');
  r=await fetch(base+'/api/admin/bookings/'+b.id,{method:'POST',headers:{'Content-Type':'application/json','X-HQ-Action':'1',Cookie:'hq_admin='+staff.token},body:JSON.stringify({action:'confirm',version:1,slotId:s.id,note:'HTTP隔离确认'})});assert.equal(r.status,200);
  r=await fetch(base+'/api/visitor/bookings/'+b.id,{headers:{Authorization:'Bearer '+token.token}});const record=await r.json();assert.equal(record.state,'confirmed');assert.equal(record.confirmed.date,s.date);assert.equal(record.request.enrollment.id,s.id);
  const current=f.service.slots()[0];update(f,current,{enrollment:{...current.enrollment,state:'archived'}});assert.equal((await fetch(base+'/api/public/enrollments/'+s.id)).status,404);r=await fetch(base+'/api/visitor/bookings/'+b.id,{headers:{Authorization:'Bearer '+token.token}});assert.equal((await r.json()).request.enrollment.title,'虚拟成团活动');
});
test('报名配置、系统外人数与历史申请备份恢复，恢复不保留旧会话',t=>{
  const dir=mkdtempSync(join(tmpdir(),'hq-enroll-restore-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const source=join(dir,'source');mkdirSync(source);const f=fixture(t,join(source,'huangqiao.sqlite')),s=save(f),b=apply(f,s);confirm(f,b,s);issueSession(f.db,f.a.id,'visitor');
  const backup=join(dir,'backup'),target=join(dir,'restored');backupData(source,backup);restoreData(backup,target);const restored=openDatabase(join(target,'huangqiao.sqlite'));try{const service=new Service(restored);assert.equal(service.enrollment(s.id).remaining,1);assert.equal(service.slots()[0].external_count,4);assert.equal(service.getBooking(b.id,f.a).request.enrollment.title,'虚拟成团活动');assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);}finally{restored.close();}
});
