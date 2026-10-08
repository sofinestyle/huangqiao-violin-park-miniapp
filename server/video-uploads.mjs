import {randomUUID,createHash} from 'node:crypto';
import {Fault,requireValue,permit,text,audit} from './security.mjs';
import {decode,now} from './db.mjs';
import {MAX_UPLOAD} from './media.mjs';
import {LocalStorage} from './storage/index.mjs';

export const VIDEO_UPLOAD_ROUTE='admin:direct-video:v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const extensions={'video/mp4':'.mp4','video/webm':'.webm'};
const TASK_MS=10*60_000, CLEANUP_MS=15*60_000, LEASE_MS=300_000;
const readTask=async(db,owner,id)=>{const row=await db.maybeOne('SELECT response FROM idempotency WHERE owner=$1 AND route=$2 AND key=$3',[owner,VIDEO_UPLOAD_ROUTE,id]);return row&&decode(row.response);};
const writeTask=(db,t)=>db.execute('UPDATE idempotency SET response=$1 WHERE owner=$2 AND route=$3 AND key=$4',[JSON.stringify(t),t.owner,VIDEO_UPLOAD_ROUTE,t.id]);
const locked=(db,id,fn)=>db.transaction(async()=>{await db.lockKey('hq:video:'+id);return fn();});
async function currentPermission(db,owner){const a=await db.maybeOne('SELECT active,roles FROM accounts WHERE id=$1',[owner]);requireValue(a?.active, '账号已停用',403,'ACCOUNT_DISABLED');permit({roles:decode(a.roles)},'content');}
function taskKey(t){requireValue(uuid.test(t.id)&&t.objectKey===t.id+extensions[t.mime], '上传对象无效',400,'UPLOAD_KEY_INVALID');return t.objectKey;}
function publicTask(t){return {id:t.id,state:t.state,expiresAt:t.expiresAt,...(t.result?{media:t.result}:{}),...(t.error?{error:t.error,code:t.code}:{} )};}
function onlyFields(value,allowed){requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k)),'上传参数含不允许的字段',400,'UPLOAD_FIELDS_INVALID');}
export async function authorizeVideo(db,actor,storage,input,clock=Date.now){
 permit(actor,'content');onlyFields(input,['filename','mime','size','rights']);
 requireValue(Object.hasOwn(extensions,input.mime),'仅支持MP4、WebM视频',415,'VIDEO_TYPE_INVALID');
 requireValue(Number.isSafeInteger(input.size)&&input.size>12&&input.size<=MAX_UPLOAD,'文件为空或超过64MiB上传上限',413,'VIDEO_SIZE_INVALID');
 const filename=text(input.filename,'文件名',180),rights=text(input.rights,'权属说明',800);
 if(typeof storage==='string'||storage instanceof LocalStorage)return {transport:'local-proxy'};
 requireValue(typeof storage.signVideoUpload==='function','当前存储未启用视频直传',503,'DIRECT_UPLOAD_UNAVAILABLE');
 const id=randomUUID(),createdAt=clock(),t={id,owner:actor.id,filename,rights,mime:input.mime,size:input.size,objectKey:id+extensions[input.mime],state:'pending',createdAt,expiresAt:createdAt+TASK_MS,cleanupAt:createdAt+CLEANUP_MS};
 await db.transaction(async()=>{await db.lockKey('hq:accounts');await currentPermission(db,actor.id);await db.execute('INSERT INTO idempotency(owner,route,key,fingerprint,response) VALUES($1,$2,$3,$4,$5)',[actor.id,VIDEO_UPLOAD_ROUTE,id,id,JSON.stringify(t)]);});
 try{const signed=await storage.signVideoUpload(taskKey(t));return {id,uploadUrl:signed.url,uploadExpiresAt:signed.expiresAt,expiresAt:t.expiresAt,method:'PUT'};}
 catch{await locked(db,id,async()=>{t.state='failed';t.error='获取上传授权失败，请重试';t.code='UPLOAD_SIGN_FAILED';await writeTask(db,t);});throw new Fault(502,'获取上传授权失败，请重试','UPLOAD_SIGN_FAILED');}
}
export async function getVideoTask(db,actor,id,clock=Date.now){
 permit(actor,'content');requireValue(uuid.test(id),'上传任务无效',400,'UPLOAD_ID_INVALID');
 const t=await readTask(db,actor.id,id);requireValue(t,'上传任务不存在',404,'UPLOAD_NOT_FOUND');taskKey(t);
 if(t.state!=='done'&&clock()>t.expiresAt)return {...publicTask(t),state:'expired',error:'上传授权已过期，请重新上传',code:'UPLOAD_EXPIRED'};
 return publicTask(t);
}
export async function completeVideo(db,actor,id,input,clock=Date.now){
 permit(actor,'content');requireValue(uuid.test(id),'上传任务无效',400,'UPLOAD_ID_INVALID');onlyFields(input,[]);
 return locked(db,id,async()=>{
  const t=await readTask(db,actor.id,id);requireValue(t,'上传任务不存在',404,'UPLOAD_NOT_FOUND');taskKey(t);
  if(t.state==='done')return publicTask(t);
  requireValue(clock()<=t.expiresAt,'上传授权已过期，请重新上传',410,'UPLOAD_EXPIRED');
  requireValue(t.state==='pending'||t.state==='verifying',t.error||'上传任务不可提交',409,t.code||'UPLOAD_FAILED');
  t.state='verifying';await writeTask(db,t);return publicTask(t);
 });
}
// Verification is outside request/DB transactions. Persistent leases survive a
// process restart and prevent replicas from double-registering or deleting media.
export function videoUploadWorker(db,storage,{clock=Date.now,onError=()=>console.error('视频上传任务处理失败')}={}){
 let running=false;
 async function claim(owner,id){return locked(db,id,async()=>{
  const t=await readTask(db,owner,id);if(!t||t.state==='done'||(t.leaseUntil||0)>clock())return null;
  const cleaning=clock()>=t.cleanupAt&&(t.nextCleanupAt||0)<=clock();
  if(!cleaning&&(t.state!=='verifying'||clock()>t.expiresAt))return null;
  taskKey(t);t.lease=randomUUID();t.leaseUntil=clock()+LEASE_MS;if(cleaning)t.state='expired';await writeTask(db,t);return {t,cleaning};
 });}
 async function finish(t,change){return locked(db,t.id,async()=>{const current=await readTask(db,t.owner,t.id);if(current?.lease!==t.lease)return false;await writeTask(db,{...current,...change,lease:null,leaseUntil:0});return true;});}
 async function processTask({t,cleaning}){
  if(cleaning){
   // Only this persisted server-generated object, never arbitrary bucket objects.
   const existing=await db.maybeOne('SELECT id FROM media WHERE id=$1 OR object_key=$2',[t.id,t.objectKey]);
   if(!existing)await storage.delete(t.objectKey);
   await finish(t,{state:'expired',error:'上传授权已过期，请重新上传',code:'UPLOAD_EXPIRED',nextCleanupAt:clock()+3600_000});return;
  }
  try{
   await currentPermission(db,t.owner);
   const metadata=await storage.videoMetadata(t.objectKey);
   requireValue(metadata.size===t.size&&metadata.size<=MAX_UPLOAD&&metadata.mime===t.mime,'远端视频大小或类型与授权不符',422,'VIDEO_OBJECT_INVALID');
   const stream=await storage.read(t.objectKey);const hash=createHash('sha256');let size=0,header=Buffer.alloc(0);
   try{for await(const chunk of stream){size+=chunk.length;requireValue(size<=t.size&&size<=MAX_UPLOAD,'远端视频大小超限',422,'VIDEO_OBJECT_INVALID');if(header.length<32)header=Buffer.concat([header,chunk.subarray(0,32-header.length)]);hash.update(chunk);}}finally{stream.destroy();}
   const valid=t.mime==='video/mp4'?header.length>12&&header.subarray(4,8).toString()==='ftyp':header.subarray(0,4).toString('hex')==='1a45dfa3';
   requireValue(valid&&size===t.size,'远端视频文件内容无效',422,'VIDEO_OBJECT_INVALID');
   const sha=hash.digest('hex'),result={id:t.id,filename:t.filename,mime:t.mime,size,rights:t.rights,url:`/api/media/${t.id}`,previewUrl:`/api/admin/media/${t.id}/file`};
   await db.transaction(async()=>{
    await db.lockKey('hq:accounts');await db.lockKey('hq:video:'+t.id);
    const current=await readTask(db,t.owner,t.id);if(current?.lease!==t.lease)return;
    await currentPermission(db,t.owner);requireValue(clock()<=t.expiresAt,'上传授权已过期，请重新上传',410,'UPLOAD_EXPIRED');
    await db.execute('INSERT INTO media VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[t.id,t.filename,t.mime,size,sha,t.objectKey,t.rights,null,now()]);
    await audit(db,{id:t.owner},'media.upload',t.id,{filename:t.filename,mime:t.mime,size,sha256:sha,transport:'direct'});
    await writeTask(db,{...current,state:'done',result,lease:null,leaseUntil:0});
   });
  }catch(e){
   // Never delete on uncertain commit outcome. Expired-task sweep rechecks media.
   await finish(t,{state:'failed',error:e instanceof Fault?e.message:'视频校验失败，请重新上传；未登记素材',code:e instanceof Fault?e.code:'VIDEO_VERIFY_FAILED'});
  }
 }
 return {async tick(){if(running)return;running=true;try{
  const rows=await db.many("SELECT owner,key FROM idempotency WHERE route=$1 AND response->>'state'<>'done' AND (COALESCE((response->>'leaseUntil')::bigint,0)<=$2) AND ((response->>'state'='verifying' AND (response->>'expiresAt')::bigint>=$2) OR ((response->>'cleanupAt')::bigint<=$2 AND COALESCE((response->>'nextCleanupAt')::bigint,0)<=$2)) ORDER BY response->>'createdAt' LIMIT 4",[VIDEO_UPLOAD_ROUTE,clock()]);
  await Promise.all(rows.map(async row=>{try{const item=await claim(row.owner,row.key);if(item)await processTask(item);}catch{onError();}}));
 }catch{onError();}finally{running=false;}}};
}
