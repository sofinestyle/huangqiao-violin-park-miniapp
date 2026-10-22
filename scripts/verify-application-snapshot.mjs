import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {openPostgres,migrate} from '../server/pg/database.mjs';
import {LocalStorage} from '../server/storage/index.mjs';
import {createHttpServer} from '../server/http.mjs';
async function main(){
// Offline verification only: restore into a NEW localhost test DB, then remove it.
// Never accepts a cloud destination or overwrites a local business database.
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--backup-directory','--key-file','--test-url-file','--report'].includes(args[i])||!args[i+1]||Object.hasOwn(options,args[i]))throw Error('BACKUP_VERIFY_ARGUMENTS');options[args[i]]=args[i+1];}
for(const k of ['--backup-directory','--key-file','--test-url-file','--report'])if(!options[k])throw Error('BACKUP_VERIFY_ARGUMENTS');
const root=path.resolve(options['--backup-directory']),complete=fs.existsSync(root+'/manifest.json');
if(!complete)throw Error('COMPLETE_BACKUP_REQUIRED');
const manifest=JSON.parse(fs.readFileSync(root+'/manifest.json'));
if(manifest.source.database!=='postgres-i56vqlwu'||manifest.source.schema!=='app'||!manifest.complete)throw Error('SOURCE_GUARD');
const keyPath=path.resolve(options['--key-file']);
const key=fs.readFileSync(keyPath);if(key.length!==32||(fs.statSync(keyPath).mode&0o077))throw Error('KEY_PERMISSION_GUARD');
const report=path.resolve(options['--report']);if(!report.startsWith(path.resolve('.qa')+'/')||fs.existsSync(report))throw Error('NEW_PRIVATE_REPORT_REQUIRED');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function decipher(meta){if(!/^[\w./-]+$/.test(meta.file)||meta.file.includes('..'))throw Error('FILE_GUARD');const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(meta.iv,'hex'));d.setAuthTag(Buffer.from(meta.tag,'hex'));return d;}
function decrypt(meta){const d=decipher(meta),b=Buffer.concat([d.update(fs.readFileSync(path.join(root,meta.file))),d.final()]);if(sha(b)!==meta.sha256||b.length!==meta.bytes)throw Error('BACKUP_HASH_FAILED');return b;}
const data=JSON.parse(decrypt(manifest.database));
if(!Array.isArray(data.media)||!Array.isArray(manifest.objects)||manifest.objects.length!==data.media.length||new Set(manifest.objects.map(x=>x.id)).size!==data.media.length)throw Error('BACKUP_MEDIA_SET_MISMATCH');
for(const x of manifest.objects){const source=data.media.find(r=>r.id===x.id);if(!source||!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(x.object_key)||x.object_key!==source.object_key||x.sha256!==source.sha256||x.size!==source.size)throw Error('BACKUP_OBJECT_MAPPING_MISMATCH');}
if(sha(decrypt(manifest.schemaArtifact))!==sha(fs.readFileSync('pg/migrations/001_initial_schema.sql')))throw Error('SCHEMA_MISMATCH');
decrypt(manifest.runtime); // Authenticate the encrypted rollback configuration too.
const testUrl=fs.readFileSync(options['--test-url-file'],'utf8').trim(),u=new URL(testUrl);
if(!['127.0.0.1','localhost'].includes(u.hostname)||!/^\/hq_test_[a-z0-9_]+$/.test(u.pathname)||u.search||u.hash)throw Error('LOCAL_RESTORE_ONLY');
const id=crypto.randomUUID().replaceAll('-',''),name='hq_test_promotion_restore_'+id;
const localRoot=path.resolve('.local/promotion-restore-'+id),control=openPostgres({connectionString:testUrl});
let db,server,created=false;
const result={sourceReadOnly:true,cloudWrites:0,localHost:u.hostname,localPort:u.port,database:name,schema:'app',backupComplete:complete,physicalCloudRecovery:false};
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function normalize(rows,table){const timestamps=data.__columns.filter(c=>c.table_name===table&&c.data_type.startsWith('timestamp')).map(c=>c.column_name);return rows.map(row=>{row={...row};for(const c of timestamps)if(row[c]){const fraction=/\.(\d+)/.exec(row[c])?.[1]||'';row[c]=new Date(row[c]).toISOString().replace(/\.\d{3}Z$/,'.'+fraction.padEnd(6,'0').slice(0,6)+'Z');}return canonical(row);}).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}
try{
 await control.query('CREATE DATABASE '+name);created=true;u.pathname='/'+name;db=openPostgres({connectionString:u.toString(),schema:'app'});await migrate(db);
 const columns=await db.many("SELECT table_name,column_name,data_type,is_nullable,is_identity,identity_generation FROM information_schema.columns WHERE table_schema='app' ORDER BY table_name,ordinal_position");
 const sourceColumns=data.__columns.map(c=>Object.fromEntries(['table_name','column_name','data_type','is_nullable','is_identity','identity_generation'].map(k=>[k,c[k]])));
 if(JSON.stringify(canonical(columns))!==JSON.stringify(canonical(sourceColumns)))throw Error('RESTORE_COLUMN_MISMATCH');
 const order=['accounts','visitors','content','slots','bookings','changes','consultations','idempotency','media','audit','product_skus','sessions','migrations'];
 await db.transaction(async()=>{
  await db.query('DELETE FROM migrations');
  for(const table of order){
   if(!Array.isArray(data[table]))throw Error('RESTORE_TABLE_GUARD');
   const cols=data.__columns.filter(c=>c.table_name===table).sort((a,b)=>a.ordinal_position-b.ordinal_position);
   for(const row of data[table]){
    const values=cols.map(c=>{const v=row[c.column_name];if(v===undefined)throw Error('RESTORE_MISSING_COLUMN');if(['json','jsonb'].includes(c.data_type)){if(v===null&&c.is_nullable==='YES')throw Error('AMBIGUOUS_NULL_BACKUP');return JSON.stringify(v);}return v;});
    try{await db.query('INSERT INTO '+table+' ('+cols.map(c=>'"'+c.column_name+'"').join(',')+') VALUES ('+cols.map((c,i)=>'$'+(i+1)).join(',')+')',values);}catch(e){console.log('RESTORE_TABLE_FAILED',{table,code:e.pgCode||e.code});throw e;}
   }
  }
  await db.query("SELECT setval(pg_get_serial_sequence('audit','id'),GREATEST(COALESCE((SELECT max(id) FROM audit),0),1),EXISTS(SELECT 1 FROM audit))");
  await db.query('SET CONSTRAINTS ALL IMMEDIATE');
 });
 result.tables={};
 for(const table of order){const r=await db.one("SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') AS rows FROM "+table+' t');if(JSON.stringify(normalize(data[table],table))!==JSON.stringify(normalize(r.rows,table)))throw Error('RESTORE_TABLE_HASH_MISMATCH');result.tables[table]={count:r.rows.length,matched:true};}
 result.applicationDatabaseRestore='PASS';
 if(complete){
  fs.mkdirSync(localRoot,{recursive:true,mode:0o700});let mediaBytes=0;
  for(const m of manifest.objects){const hash=crypto.createHash('sha256');let size=0;const count=new Transform({transform(b,e,cb){size+=b.length;hash.update(b);cb(null,b)}});await pipeline(fs.createReadStream(path.join(root,m.file)),decipher(m),count,fs.createWriteStream(path.join(localRoot,m.object_key),{flags:'wx',mode:0o600}));if(size!==m.size||hash.digest('hex')!==m.sha256)throw Error('RESTORED_MEDIA_MISMATCH');mediaBytes+=size;}
  const storage=new LocalStorage(localRoot),http=createHttpServer({db,root:process.cwd(),storage,environment:'staging',adminOrigin:'https://admin.yorray.com',readOnly:true});server=http.server;await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const list=await(await fetch(base+'/api/public/content')).json();if(list.length!==51)throw Error('PUBLIC_CONTENT_RESTORE_FAILED');
  const site=data.content.find(x=>x.kind==='site'),image=(site.data.images||[]).find(x=>x.startsWith('/api/media/'));
  const lesson=data.content.find(x=>x.kind==='lesson'&&x.data.mediaId);if(!image||!lesson)throw Error('RESTORE_MEDIA_FIXTURE_MISSING');
  const r=await fetch(base+image);const imageHash=sha(Buffer.from(await r.arrayBuffer()));if(r.status!==200||!manifest.objects.some(m=>m.id===image.split('/').pop()&&m.sha256===imageHash))throw Error('RESTORED_IMAGE_HTTP_FAILED');
  const video=await fetch(base+'/api/media/'+lesson.data.mediaId,{headers:{Range:'bytes=0-1023'}});const range=Buffer.from(await video.arrayBuffer());if(video.status!==206||range.length!==1024||!/^bytes 0-1023\//.test(video.headers.get('content-range')||''))throw Error('RESTORED_VIDEO_RANGE_FAILED');
  result.media={count:manifest.objects.length,bytes:mediaBytes,allHashesMatched:true,imageStatus:r.status,videoRangeStatus:video.status};
 }else result.media='PENDING_COMPLETE_BACKUP';
 result.status=complete?'PASS':'DATABASE_ONLY_PASS';
}finally{
 if(server)await new Promise(r=>server.close(r));if(db)await db.close();if(created)await control.query('DROP DATABASE '+name+' WITH (FORCE)');await control.close();await fsp.rm(localRoot,{recursive:true,force:true});result.disposableLocalDatabaseRemoved=created;result.decryptedMediaRemoved=true;
}
fs.writeFileSync(report,JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result,null,2));

}
main().catch(e=>{console.error('BACKUP_VERIFY_FAILED',/^[A-Z_]+$/.test(e.message)?e.message:'SAFE_FAILURE');process.exitCode=1;});
