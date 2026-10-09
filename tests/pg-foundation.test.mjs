import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openPostgres,migrate,now} from '../server/pg/database.mjs';
import {Foundation} from '../server/pg/foundation.mjs';
import {productPayload,option} from '../server/sku-seed.mjs';

function testConfig(){
 if(process.env.APP_ENV&&process.env.APP_ENV!=='development')throw new Error('测试拒绝非development环境');
 const connectionString=process.env.TEST_DATABASE_URL;
 if(!connectionString)throw new Error('需要专用TEST_DATABASE_URL');
 const u=new URL(connectionString);
 if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||!/^\/hq_test_[a-z0-9_]+$/.test(u.pathname))throw new Error('测试仅允许本地专用hq_test_数据库');
 return {connectionString,schema:'test_'+randomUUID().replaceAll('-',''),max:12};
}
async function fixture(t){const db=openPostgres(testConfig());t.after(async()=>{await db.query(`DROP SCHEMA ${db.schema} CASCADE`);await db.close();});await migrate(db);return {db,s:new Foundation(db)};}
const actor={id:'synthetic-admin',roles:['admin']};
const edit=p=>{const {id,kind,name,state,sort,version,skus,...data}=p;return {kind,name,state,sort,version,data,skus:skus.filter(s=>s.current)};};

test('教学业务类型持久化且不能绕过原有视频发布校验；旧视频保持兼容',async t=>{
 const {db,s}=await fixture(t);
 const lesson=(teachingType,type,state='draft',extra={})=>({kind:'lesson',name:'合成教学类型验证',state,data:{type,teachingType,isTest:true,images:[],...extra}});
 for(const [choice,format] of [['unboxing','video'],['product_video','video'],['violin_course','course'],['article','article'],['other','article']]){
  const saved=await s.saveContent(actor,lesson(choice,format));
  assert.equal((await s.content(saved.id,false)).teachingType,choice);
  assert.equal(saved.type,format);
 }
 for(const choice of ['unboxing','product_video','other']){
  await assert.rejects(s.saveContent(actor,lesson(choice,'video','published')),/实际上传视频/);
 }
 await assert.rejects(s.saveContent(actor,lesson('unboxing','article','published')),/内容格式不一致/);
 await assert.rejects(s.saveContent(actor,lesson('invalid','article')),/请选择有效/);
 await assert.rejects(s.saveContent(actor,lesson(['article'],'article')),/请选择有效/);
 await db.execute('INSERT INTO media VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',['synthetic-video','synthetic.mp4','video/mp4',1,'0'.repeat(64),'synthetic.mp4','合成测试授权',null,now()]);
 for(const choice of ['unboxing','product_video','other']){
  await assert.rejects(s.saveContent(actor,lesson(choice,'video','published',{mediaId:'synthetic-video',duration:0})),/实际时长/);
  const saved=await s.saveContent(actor,lesson(choice,'video','published',{mediaId:'synthetic-video',duration:12.34}));
  assert.equal((await s.content(saved.id)).type,'video');
 }
 const legacy=lesson(undefined,'video','published',{mediaId:'synthetic-video',duration:12.34});
 delete legacy.data.teachingType;
 const saved=await s.saveContent(actor,legacy);
 assert.equal(saved.type,'video');assert.equal(saved.teachingType,undefined);
});

test('PG A: initial schema, repeat migration, JSONB, FK/check/unique and rollback',async t=>{
 const {db,s}=await fixture(t);await migrate(db);
 assert.equal((await db.one('SELECT count(*) n FROM migrations')).n,1);
 assert.equal((await db.one('SELECT count(*) n FROM information_schema.tables WHERE table_schema=$1',[db.schema])).n,13);
 const p=await s.saveContent(actor,productPayload('PG单规格'));
 assert.equal((await db.one('SELECT jsonb_typeof(data) t FROM content')).t,'object');
 await assert.rejects(db.execute('UPDATE product_skus SET product_id=$1',['missing']),e=>e.pgCode==='23503');
 await assert.rejects(db.execute('UPDATE product_skus SET reference_price=-1'),e=>e.pgCode==='23514');
 await assert.rejects(db.transaction(async()=>{await db.execute('DELETE FROM product_skus');throw new Error('rollback');}),/rollback/);
 assert.equal((await db.one('SELECT count(*) n FROM product_skus')).n,1);
 const q=productPayload('重复');q.skus[0].sku_code=p.skus[0].sku_code.toLowerCase();await assert.rejects(s.saveContent(actor,q),e=>e.code==='SKU_CODE_CONFLICT');
 assert.equal((await db.one('SELECT count(*) n FROM content')).n,1);
 assert.equal((await db.one('SELECT count(*) n FROM audit')).n,1);
});
test('PG A: Content plus 10 SKU identity, price zero, concurrent version conflict and late rollback',async t=>{
 const {db,s}=await fixture(t);const p=await s.saveContent(actor,productPayload('矩阵',[option('尺寸',['1/8','1/4','1/2','3/4','4/4']),option('颜色',['自然','棕'],1)]));
 assert.equal(p.skus.length,10);const q=edit(p);q.skus[0].reference_price=0;
 const results=await Promise.allSettled([s.saveContent(actor,q,p.id),s.saveContent(actor,q,p.id)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.code,'VERSION_CONFLICT');
 const next=await s.content(p.id,false);assert.equal(next.skus[0].effectiveReferencePrice,0);assert.equal(next.skus[0].id,p.skus[0].id);
 const before=await db.many('SELECT * FROM content');
 await db.query("CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$; CREATE TRIGGER audit_fail BEFORE INSERT ON audit FOR EACH ROW EXECUTE FUNCTION fail_audit()");
 await assert.rejects(s.saveContent(actor,{...edit(next),name:'rollback'},p.id),/synthetic/);assert.deepEqual(await db.many('SELECT * FROM content'),before);
});
test('PG A: ten independent requests compete for final capacity, exactly one success',async t=>{
 const {db,s}=await fixture(t);
 await db.execute('INSERT INTO accounts VALUES($1,$2,$3,$4,true,true,$5)',[actor.id,'synthetic','unused',JSON.stringify(['admin']),now()]);
 await db.execute('INSERT INTO visitors VALUES($1,NULL,$2)',['visitor',now()]);
 await db.execute("INSERT INTO slots(id,date,start,\"end\",capacity,package_ids,note) VALUES('slot','2099-01-01','09:00','10:00',1,'[\"package\"]','')");
 for(let i=0;i<10;i++)await db.execute("INSERT INTO bookings(id,owner,snapshot,request,state,headcount,created_at,updated_at) VALUES($1,'visitor',$2,$3,'pending',1,$4,$4)",['booking'+i,JSON.stringify({id:'package'}),JSON.stringify({adults:1,children:0}),now()]);
 const results=await Promise.allSettled(Array.from({length:10},(_,i)=>s.handleBooking(actor,'booking'+i,{action:'confirm',version:1,slotId:'slot',note:'已联系确认'})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.code==='CAPACITY_FULL'));
 assert.equal((await db.one("SELECT sum(headcount) n FROM bookings WHERE state='confirmed'")).n,1);
 assert.equal((await db.one('SELECT count(*) n FROM audit')).n,1);
});
test('PG A: concurrent idempotent SKU consultation and immutable snapshot',async t=>{
 const {db,s}=await fixture(t);const payload=productPayload('已发布合成产品');payload.state='published';const p=await s.saveContent(actor,payload);
 await db.execute('INSERT INTO visitors VALUES($1,NULL,$2)',['visitor',now()]);
 const body={contentId:p.id,skuId:p.skus[0].id,contactName:'合成',phone:'13800000000',consent:true,message:'合成咨询'};
 const results=await Promise.all(Array.from({length:10},()=>s.createConsultation({id:'visitor'},body,'same-key-001')));
 assert.equal(new Set(results.map(x=>x.id)).size,1);assert.equal((await db.one('SELECT count(*) n FROM consultations')).n,1);
 const snap=(await db.one('SELECT snapshot FROM consultations')).snapshot;assert.equal(snap.sku.id,p.skus[0].id);assert.equal(snap.sku.code,p.skus[0].sku_code);
 await assert.rejects(s.createConsultation({id:'visitor'},{...body,message:'不同'},'same-key-001'),e=>e.code==='IDEMPOTENCY_CONFLICT');
 await s.saveContent(actor,{...edit(p),name:'新名称'},p.id);assert.deepEqual((await db.one('SELECT snapshot FROM consultations')).snapshot,snap);
});
test('PG A: database enforces code and combination uniqueness; failed DDL has no partial state',async t=>{
 const {db,s}=await fixture(t);const a=await s.saveContent(actor,productPayload('a')),b=await s.saveContent(actor,productPayload('b'));
 await assert.rejects(db.execute('UPDATE product_skus SET sku_code=$1 WHERE id=$2',[a.skus[0].sku_code.toLowerCase(),b.skus[0].id]),e=>e.code==='SKU_CODE_CONFLICT');
 await assert.rejects(db.execute('UPDATE product_skus SET product_id=$1 WHERE id=$2',[a.id,b.skus[0].id]),e=>e.pgCode==='23505');
 await assert.rejects(db.transaction(async()=>{await db.query('CREATE TABLE partial_ddl(id INTEGER)');await db.query('SELECT missing_column FROM content');}));
 assert.equal((await db.one("SELECT to_regclass($1) n",[db.schema+'.partial_ddl'])).n,null);
 await db.execute("UPDATE migrations SET checksum='changed'");await assert.rejects(migrate(db),/校验和/);
});
