import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './admin-business-fixture.mjs';
import {issueSession,authenticate,createAccount} from '../server/security.mjs';
import {auditQuery} from '../server/audit-query.mjs';
import {auditActionLabel,AUDIT_ACTION_LABELS} from '../admin/src/audit-actions.mjs';
async function setup(t){const f=await fixture();t.after(()=>f.close());const token=issueSession(f.db,f.actor.id,'admin').token;
 const request=(path,{method='GET',data,auth=token}={})=>fetch(f.base+'/api/admin/'+path,{method,headers:{'Content-Type':'application/json','X-HQ-Action':'1',...(auth?{Cookie:'hq_admin='+auth}:{})},...(data?{body:JSON.stringify(data)}:{})});return {...f,request,token};}
const payload=a=>({...a,password:''});
function synthesize(db,count=1205){db.exec('BEGIN');try{const insert=db.prepare('INSERT INTO audit(actor,action,object,detail,created_at) VALUES (?,?,?,?,?)');for(let i=0;i<count;i++)insert.run('synthetic-'+i%3,i%2?'booking.confirm':'media.upload','synthetic-'+i,JSON.stringify({synthetic:true,sequence:i}),new Date(Date.UTC(2025,0,1,0,0,Math.floor(i/3))).toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
test('ABI-01 pending/following legal assign/followup/close; closed protects history against every action',async t=>{
 const f=await setup(t);for(const initial of [f.records.consultPending,f.records.consultFollowing]){
  let row=initial;for(const action of ['assign','followup','close']){const r=await f.request('consultations/'+row.id,{method:'POST',data:{action,version:row.version,assignee:f.accounts.reception.id,note:'合成验证联系记录'}});assert.equal(r.status,200);row=await r.json();}assert.equal(row.state,'closed');const before=JSON.stringify(row);
  for(const action of ['assign','followup','close'])assert.equal((await f.request('consultations/'+row.id,{method:'POST',data:{action,version:row.version,assignee:f.accounts.reception.id,note:'不可修改'}})).status,409);
  assert.equal(JSON.stringify(await(await f.request('consultations/'+row.id)).json()),before);
 }
});
test('ABI-02 booking/consultation CSV shares every filter, combinations, empty and legacy full range; format preserved',async t=>{
 const f=await setup(t);for(const kind of ['bookings','consultations']){
  const filters=[{}, {state:'pending'},{q:'验证'},{unassigned:'1'},{q:'不存在'}, {state:'pending',q:'验证',unassigned:'1'},...(kind==='bookings'?[{enrollment:'1'},{state:'pending',enrollment:'1',unassigned:'1',q:'跟团'}]:[])];
  for(const filter of filters){const params=new URLSearchParams(filter),list=await(await f.request(kind+'?'+params)).json();const r=await f.request('export?kind='+kind+'&'+params);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');const lines=bytes.toString().slice(1).split('\r\n');assert.equal(lines[1],'"编号","联系人","手机号","状态","意向日期","人数"');assert.deepEqual(lines.slice(2).map(line=>line.split(',')[0].slice(1,-1)),list.map(x=>x.id));}
 }
 f.book({contactName:'=FORMULA'});const csv=await(await f.request('export?q=FORMULA')).text();assert.ok(csv.includes('"\'=FORMULA"'));
});
test('ABI-02 independent export permission and roles, anonymous, grant/revoke applied immediately',async t=>{
 const f=await setup(t);assert.equal((await f.request('export',{auth:null})).status,401);
 for(const role of ['content','reception']){const a=f.accounts[role],token=issueSession(f.db,a.id,'admin').token;assert.equal((await f.request('export',{auth:token})).status,403);assert.equal((await f.request('accounts/'+a.id,{method:'PUT',data:{...payload(a),active:true,canExport:true}})).status,200);assert.equal((await f.request('export',{auth:token})).status,role==='reception'?200:403);assert.equal((await f.request('accounts/'+a.id,{method:'PUT',data:{...payload(a),active:true,canExport:false}})).status,200);assert.equal((await f.request('export',{auth:token})).status,403);assert.equal((await f.request('me',{auth:token})).status,200);}
});
test('ABI-03 active true/false/default creation, disabled login/session rejection, subsequent enable; malformed active rejected',async t=>{
 const f=await setup(t);for(const active of [true,false,undefined]){const password=randomUUID(),data={username:'created_'+String(active),password,roles:['content'],...(active!==undefined?{active}:{})};const r=await f.request('accounts',{method:'POST',data});assert.equal(r.status,201);const a=await r.json();assert.equal(a.active,active!==false);assert.equal(f.db.prepare('SELECT active FROM accounts WHERE id=?').get(a.id).active,+(active!==false));const login=()=>f.request('login',{method:'POST',auth:null,data:{username:a.username,password}});assert.equal((await login()).status,active===false?401:200);if(active===false){const token=issueSession(f.db,a.id,'admin').token;assert.throws(()=>authenticate(f.db,token,'admin'),e=>e.status===401);await f.request('accounts/'+a.id,{method:'PUT',data:{...payload(a),active:true}});assert.equal((await login()).status,200);assert.throws(()=>authenticate(f.db,token,'admin'),e=>e.status===401);}}
 assert.equal((await f.request('accounts',{method:'POST',data:{username:'bad_active',password:randomUUID(),roles:['content'],active:'false'}})).status,400);
});
test('ABI-04 password reset invalidates all sessions and old password while retaining new login',async t=>{
 const f=await setup(t),a=f.accounts.reception,tokens=[issueSession(f.db,a.id,'admin').token,issueSession(f.db,a.id,'admin').token],password=randomUUID();assert.equal((await f.request('accounts/'+a.id,{method:'PUT',data:{...payload(a),password,active:true}})).status,200);for(const auth of tokens)assert.equal((await f.request('me',{auth})).status,401);assert.equal((await f.request('login',{method:'POST',auth:null,data:{username:a.username,password:f.passwords.reception}})).status,401);assert.equal((await f.request('login',{method:'POST',auth:null,data:{username:a.username,password}})).status,200);
});
test('ABI-04 roles change invalidates all sessions; role reorder/no-op and canExport-only preserve sessions',async t=>{
 const f=await setup(t),a=createAccount(f.db,{username:'multi_role',password:randomUUID(),roles:['content','reception']});const tokens=[issueSession(f.db,a.id,'admin').token,issueSession(f.db,a.id,'admin').token];for(const data of [{...payload(a),roles:['reception','content']},{...payload(a),canExport:true},{...payload(a)}]){assert.equal((await f.request('accounts/'+a.id,{method:'PUT',data})).status,200);for(const auth of tokens)assert.equal((await f.request('me',{auth})).status,200);}await f.request('accounts/'+a.id,{method:'PUT',data:{...payload(a),roles:['content']}});for(const auth of tokens)assert.equal((await f.request('me',{auth})).status,401);
});
test('ABI-04 disable invalidates every session, re-enable never revives; last administrator protection preserved',async t=>{
 const f=await setup(t),a=f.accounts.reception,token=issueSession(f.db,a.id,'admin').token;await f.request('accounts/'+a.id,{method:'PUT',data:{...payload(a),active:false}});assert.equal((await f.request('me',{auth:token})).status,401);await f.request('accounts/'+a.id,{method:'PUT',data:{...payload(a),active:true}});assert.equal((await f.request('me',{auth:token})).status,401);
 for(const data of [{...payload(f.actor),active:false},{...payload(f.actor),roles:['content']}])assert.equal((await f.request('accounts/'+f.actor.id,{method:'PUT',data})).status,400);assert.equal((await f.request('me')).status,200);
});
test('ABI-06 >1000 rows SQL pagination traverses every row once with stable ties and exact totals',async t=>{
 const f=await setup(t);synthesize(f.db);const expected=f.db.prepare('SELECT id FROM audit ORDER BY created_at DESC,id DESC').all().map(x=>x.id),seen=[];for(let page=1;page<=Math.ceil(expected.length/50);page++){const r=await f.request('audit?page='+page+'&pageSize=50');assert.equal(r.status,200);const result=await r.json();assert.equal(result.total,expected.length);assert.equal(result.page,page);assert.equal(result.pageSize,50);assert.ok(result.items.length<=50);seen.push(...result.items.map(x=>x.id));}assert.deepEqual(seen,expected);assert.equal(new Set(seen).size,expected.length);
 for(const size of [20,50,100])assert.equal((await(await f.request('audit?pageSize='+size)).json()).items.length,size);
 const legacy=await f.request('audit');assert.equal((await legacy.json()).length,50);assert.equal(+legacy.headers.get('X-Total-Count'),expected.length);
 assert.equal((await(await f.request('audit?page=999')).json()).items.length,0);
});
test('ABI-06 exact actor/action/time inclusive boundaries and combinations/options, original JSON intact',async t=>{
 const f=await setup(t);synthesize(f.db);const from='2025-01-01T00:01:00.000Z',to='2025-01-01T00:01:02.000Z';for(const filter of [{actor:'synthetic-1'},{action:'booking.confirm'},{from,to},{actor:'synthetic-1',action:'booking.confirm',from,to},{actor:'absent'}]){const params=new URLSearchParams({page:'1',pageSize:'100',...filter}),result=await(await f.request('audit?'+params)).json();const expected=f.db.prepare('SELECT * FROM audit').all().filter(a=>(!filter.actor ||a.actor===filter.actor)&&(!filter.action||a.action===filter.action)&&(!filter.from||a.created_at>=from)&&(!filter.to||a.created_at<=to));assert.equal(result.total,expected.length);assert.ok(result.items.every(a=>expected.some(e=>e.id===a.id)));}const exact=await(await f.request('audit?from='+from+'&to='+from)).json();assert.equal(exact.total,3);assert.ok(exact.items.every(a=>a.detail.synthetic));const opts=await(await f.request('audit/options')).json();assert.ok(opts.actions.includes('booking.confirm'));assert.ok(opts.actors.some(a=>a.id===f.actor.id&&a.name===f.actor.username));
});
test('ABI-06 malformed, duplicate, oversized and reversed query parameters return 400',async t=>{
 const f=await setup(t);for(const q of ['page=0','page=-1','page=1.5','page=9007199254740991','pageSize=101','pageSize=500','pageSize=0','page=1&page=2','unknown=x','from=no','from=2025-02-30T00:00:00Z','from=2025-01-01','from=2025-01-01T24:00:00Z','from=2025-01-02T00:00:00Z&to=2025-01-01T00:00:00Z','actor='+ 'x'.repeat(201)])assert.equal((await f.request('audit?'+q)).status,400,q);
});
test('ABI-06 audit and account security matrix prevents any privilege widening',async t=>{
 const f=await setup(t);for(const role of ['admin','content','reception','anonymous']){const auth=role==='anonymous'?null:issueSession(f.db,f.accounts[role].id,'admin').token;for(const endpoint of ['audit?page=1','audit/options','accounts'])assert.equal((await f.request(endpoint,{auth})).status,role==='admin'?200:role==='anonymous'?401:403);assert.equal((await f.request('accounts',{auth,method:'POST',data:{username:'unauthorized_'+role,password:randomUUID(),roles:['content']}})).status,role==='admin'?201:role==='anonymous'?401:403);}
});
test('ABI-06 indexes support bounded SQL query plans and >1000-row first/middle/last/filter timing',async t=>{
 const f=await setup(t);synthesize(f.db);for(const [filter,index] of [['','audit_created_at_id'],[' WHERE actor=?','audit_actor_created_at_id'],[' WHERE action=?','audit_action_created_at_id']]){const args=filter?[filter.includes('actor')?'synthetic-1':'booking.confirm']:[];const plan=f.db.prepare('EXPLAIN QUERY PLAN SELECT * FROM audit'+filter+' ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').all(...args,50,0).map(x=>x.detail).join(' ');assert.ok(plan.includes(index),plan);assert.ok(!plan.includes('TEMP B-TREE'),plan);}
 const measurements={};for(const [label,q] of Object.entries({first:'page=1',middle:'page=12',last:'page=25',actor:'actor=synthetic-1',action:'action=booking.confirm',time:'from=2025-01-01T00:01:00Z&to=2025-01-01T00:02:00Z',combined:'actor=synthetic-1&action=booking.confirm&from=2025-01-01T00:01:00Z&to=2025-01-01T00:02:00Z'})){const start=performance.now(),result=auditQuery(f.db,new URLSearchParams(q));measurements[label]={ms:Number((performance.now()-start).toFixed(3)),total:result.total,returned:result.items.length};assert.ok(result.items.length<=50);}t.diagnostic(JSON.stringify({auditRows:f.db.prepare('SELECT COUNT(*) n FROM audit').get().n,measurements}));
});
test('ABI-07 known Chinese labels, unknown raw fallback; mapping never mutates stored action',()=>{
 assert.equal(auditActionLabel('booking.confirm'),'确认研学预约');assert.equal(auditActionLabel('media.upload'),'上传素材');assert.equal(auditActionLabel('account.update'),'更新工作人员账号');for(const raw of ['future.unmapped','toString','constructor','__proto__'])assert.equal(auditActionLabel(raw),raw);assert.ok(Object.isFrozen(AUDIT_ACTION_LABELS));
});
