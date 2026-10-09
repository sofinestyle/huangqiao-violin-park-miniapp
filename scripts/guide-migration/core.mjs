import {createHash} from 'node:crypto';
import {readFile, lstat, realpath} from 'node:fs/promises';
import {resolve, relative, basename, sep} from 'node:path';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';

export const allowed = ['spot-1','spot-2','spot-3','spot-4'];
const names = ['城市客厅','音乐生态湖','产业园·中小企业集聚区','绿岛·智能环保表面处理中心'];
const files = ['city','c1','c2','c3','c4','lake','l1','l2','l3','industry','i1','i2','i3','i4','green','g1','g2','g3','g4'].map(x=>'images/'+x+'.jpg');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function canonical(v) { return JSON.stringify(v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(x=>JSON.parse(canonical(x))) : v && typeof v==='object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])) : v); }
export const digest = v => createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:canonical(v)).digest('hex');
function requireThat(ok,code) { if (!ok) { const e=new Error(code); e.code=code; throw e; } }
export function validateManifest(m) {
  requireThat(m.version===1&&m.category==='guide'&&m.batch==='guide-staging-v1'&&m.source==='.local/huangqiao.sqlite','MANIFEST_SCOPE_INVALID');
  requireThat(canonical(m.target)===canonical({environment:'staging',cloudbaseEnv:'huangqiao-staging-d2d1dj1bb4ad90',bucket:'huangqiao-media',database:'postgres-i56vqlwu',schema:'app'}),'TARGET_SCOPE_INVALID');
  requireThat(new Date(m.batchTime).toISOString()===m.batchTime,'BATCH_TIME_INVALID');
  requireThat(m.records.length===4&&m.media.length===19,'MANIFEST_COUNT_INVALID');
  for (const [i,r] of m.records.entries()) requireThat(r.source.id===allowed[i]&&r.source.name===names[i]&&r.source.kind==='spot'&&r.source.sort===80+i&&r.source.state==='published'&&r.source.data.isTest===true&&uuid.test(r.targetId),'GUIDE_ALLOWLIST_INVALID');
  for (const [i,f] of m.media.entries()) requireThat(f.sourcePath===files[i]&&f.sourceUrl==='/assets/'+basename(files[i])&&f.filename===basename(files[i])&&f.mime==='image/jpeg'&&uuid.test(f.targetId)&&f.objectKey===f.targetId+'.jpg'&&Number.isSafeInteger(f.size)&&f.size>0&&/^[0-9a-f]{64}$/.test(f.sha256)&&f.rights==='','MEDIA_MANIFEST_INVALID');
  requireThat(new Set([...m.records,...m.media].map(x=>x.targetId)).size===23,'DUPLICATE_TARGET_ID');
  const refs=m.records.flatMap(r=>r.source.data.images);
  requireThat(canonical(refs)===canonical(m.media.map(f=>f.sourceUrl)),'GUIDE_IMAGE_ORDER_INVALID');
}
async function safeFile(root,path) {
  const abs=resolve(root,path),rel=relative(root,abs);
  requireThat(rel&&!rel.startsWith('..'+sep)&&!rel.startsWith(sep),'SOURCE_PATH_INVALID');
  let current=root;
  for (const part of rel.split(sep)) {current=resolve(current,part);requireThat(!(await lstat(current)).isSymbolicLink(),'SOURCE_SYMLINK_REFUSED');}
  requireThat((await lstat(abs)).isFile(),'SOURCE_FILE_INVALID');return abs;
}
export async function inspectSource(root,m) {
  validateManifest(m);root=await realpath(root);
  const path=await safeFile(root,m.source),sqlite=new DatabaseSync(path,{readOnly:true});
  try {
    for (const r of m.records) {
      const row=sqlite.prepare('SELECT id,kind,name,data,state,sort,version,created_at,updated_at FROM content WHERE id=?').get(r.source.id);
      requireThat(row,'SOURCE_GUIDE_MISSING');row.data=JSON.parse(row.data);
      requireThat(canonical(row)===canonical(r.source),'SOURCE_GUIDE_CHANGED');
    }
  } finally {sqlite.close();}
  const bodies=new Map();
  for (const f of m.media) {
    const body=await readFile(await safeFile(root,f.sourcePath));
    requireThat(body.length===f.size&&digest(body)===f.sha256,'SOURCE_MEDIA_CHANGED');
    requireThat(body[0]===255&&body[1]===216&&body[2]===255,'SOURCE_NOT_JPEG');bodies.set(f.targetId,body);
  }
  return bodies;
}
export function expectedRows(m) {
  const map=new Map(m.media.map(f=>[f.sourceUrl,'/api/media/'+f.targetId]));
  return {content:m.records.map(r=>({id:r.targetId,kind:'spot',name:r.source.name,data:{...r.source.data,images:r.source.data.images.map(u=>map.get(u))},state:r.source.state,sort:r.source.sort,version:1,created_at:m.batchTime,updated_at:m.batchTime})),
    media:m.media.map(f=>({id:f.targetId,filename:f.filename,mime:f.mime,size:f.size,sha256:f.sha256,object_key:f.objectKey,rights:f.rights,duration:null,created_at:m.batchTime}))};
}
export function checkTarget(m,snapshot) {
  const expected=expectedRows(m),present=[];
  for(const table of ['content','media']) {
    for(const row of snapshot[table]) {
      const wanted=expected[table].find(x=>x.id===row.id);
      requireThat(wanted&&canonical(wanted)===canonical(row),'TARGET_CONFLICT');present.push(row.id);
    }
  }
  requireThat(present.length===0||present.length===23,'TARGET_PARTIAL_BATCH');
  return present.length===23?'already-migrated':'empty';
}
export function pgTarget(db,m) {
  const ids=m.records.map(r=>r.targetId),mediaIds=m.media.map(r=>r.targetId),keys=m.media.map(r=>r.objectKey);
  async function inspect() {
    return {content:await db.many('SELECT * FROM content WHERE kind=$1 OR id=ANY($2::text[]) OR name=ANY($3::text[])',['spot',ids,names]),
      media:await db.many('SELECT * FROM media WHERE id=ANY($1::text[]) OR object_key=ANY($2::text[])',[mediaIds,keys]),
      counts:{content:(await db.one('SELECT count(*) n FROM content')).n,media:(await db.one('SELECT count(*) n FROM media')).n}};
  }
  return {inspect,
    async commit() {return db.transaction(async()=>{
      await db.lockKey('hq:guide-migration:'+m.batch);
      const state=checkTarget(m,await inspect());if(state==='already-migrated')return 'already-migrated';
      const rows=expectedRows(m);
      for(const f of rows.media) await db.execute('INSERT INTO media(id,filename,mime,size,sha256,object_key,rights,duration,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',Object.values(f));
      for(const c of rows.content) await db.execute('INSERT INTO content(id,kind,name,data,state,sort,version,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[c.id,c.kind,c.name,JSON.stringify(c.data),c.state,c.sort,c.version,c.created_at,c.updated_at]);
      requireThat(checkTarget(m,await inspect())==='already-migrated','POSTCHECK_FAILED');return 'inserted';
    },{isolation:'SERIALIZABLE'});}
  };
}
async function verifyObject(storage,f) {
  let meta;try {meta=await storage.videoMetadata(f.objectKey);} catch(e) {if(e.storageStatus===404)return false;throw e;}
  requireThat(meta.size===f.size&&meta.mime===f.mime,'REMOTE_METADATA_CONFLICT');
  const hash=createHash('sha256'),stream=await storage.read(f.objectKey);let size=0;
  try {for await(const chunk of stream){size+=chunk.length;requireThat(size<=f.size,'REMOTE_SIZE_CONFLICT');hash.update(chunk);}} finally {stream.destroy();}
  requireThat(size===f.size&&hash.digest('hex')===f.sha256,'REMOTE_HASH_CONFLICT');return true;
}
export async function runMigration({root,manifest:m,target,storage,execute=false,record=async()=>{}}) {
  const bodies=await inspectSource(root,m),before=target?await target.inspect():null;
  const state=before?checkTarget(m,before):'unchecked';
  const report={mode:execute?'execute':'dry-run',manifestSha256:digest(m),targetCheck:state,
    before:before?.counts||null,projectedAfter:before?{content:before.counts.content+(state==='empty'?4:0),media:before.counts.media+(state==='empty'?19:0)}:null,planned:{content:4,media:19,bytes:m.media.reduce((n,f)=>n+f.size,0)},uploaded:0,reusedObjects:0,inserted:{content:0,media:0}};
  if(!execute)return {...report,status:state==='unchecked'?'SOURCE_READY_TARGET_UNCHECKED':'DRY_RUN_READY'};
  requireThat(target&&storage,'EXECUTE_DEPENDENCIES_REQUIRED');
  const touched=[];
  await record({event:'begin',report});
  try {
    for(const f of m.media) {
      if(await verifyObject(storage,f)){report.reusedObjects++;continue;}
      requireThat(state!=='already-migrated','REGISTERED_OBJECT_MISSING');
      touched.push(f.objectKey);await record({event:'upload-intent',objectKey:f.objectKey});
      await storage.put(f.objectKey,Readable.from([bodies.get(f.targetId)]),{mime:f.mime,size:f.size});
      requireThat(await verifyObject(storage,f),'UPLOADED_OBJECT_MISSING');report.uploaded++;
      await record({event:'object-verified',objectKey:f.objectKey});
    }
    const committed=await target.commit();
    if(committed==='inserted')report.inserted={content:4,media:19};
    const after=await target.inspect();requireThat(checkTarget(m,after)==='already-migrated','POSTCHECK_FAILED');
    report.after=after.counts;report.status='COMPLETE';await record({event:'complete',report});return report;
  } catch(e) {
    // Commit outcome can be uncertain: never delete an object automatically.
    await record({event:'failed',code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:'MIGRATION_FAILED',potentialOrphans:m.media.map(f=>f.objectKey),uploadIntents:touched,reconcileBeforeCleanup:true});throw e;
  }
}
