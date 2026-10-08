import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rename,rm,access,link,copyFile,chmod} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {openDatabase,migrate} from './db.mjs';
import {storageProvider} from './storage/index.mjs';
const sha=async path=>{const hash=createHash('sha256');for await(const b of createReadStream(path))hash.update(b);return hash.digest('hex');};
async function absent(path){try{await access(path);}catch(e){if(e.code==='ENOENT')return;throw e;}throw new Error('目标已存在，禁止覆盖');}
export function pgEnvironment(connectionString){const u=new URL(connectionString);if(!['postgres:','postgresql:'].includes(u.protocol))throw new Error('PostgreSQL连接无效');return {...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGSSLMODE:u.searchParams.get('sslmode')||'prefer'};}
export async function pgTool(tool,args,connectionString){await new Promise((resolve,reject)=>{const child=spawn(tool,args,{env:pgEnvironment(connectionString),stdio:['ignore','ignore','pipe']});let size=0;child.stderr.on('data',b=>{size+=b.length;});child.on('error',()=>reject(new Error(`${tool}不可用，请安装匹配版本的PostgreSQL工具`)));child.on('exit',code=>code===0?resolve():reject(new Error(`${tool}失败（退出码${code}），未输出连接或业务内容`)));});}
export async function backupData({db,connectionString,storage},target,{previous}={}){
 target=resolve(target);await absent(target);const temp=target+'.partial-'+Date.now();await mkdir(join(temp,'objects'),{recursive:true,mode:0o700});const provider=storageProvider(storage);let prior=null;if(previous){prior=JSON.parse(await readFile(join(previous,'manifest.json'),'utf8'));if(prior.version!==2)throw new Error('增量基础备份格式无效');}
 try{
 const manifest=await db.transaction(async()=>{
  const {snapshot}=await db.one('SELECT pg_export_snapshot() AS snapshot');
  const counts={};for(const table of ['content','product_skus','accounts','visitors','sessions','slots','bookings','changes','consultations','idempotency','media','audit','migrations'])counts[table]=(await db.one('SELECT count(*) n FROM '+table)).n;
  const migrations=await db.many('SELECT * FROM migrations ORDER BY version');
  const rows=await db.many('SELECT id,object_key,sha256,size,mime FROM media ORDER BY id');
  await pgTool('pg_dump',['--format=custom','--no-owner','--no-privileges','--schema='+db.schema,'--snapshot='+snapshot,'--file='+join(temp,'database.dump')],connectionString);
  let reusedObjects=0;for(const row of rows){if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(row.object_key))throw new Error('无效对象键');const dest=join(temp,'objects',row.object_key);const match=prior?.media.find(m=>m.object_key===row.object_key&&m.sha256===row.sha256&&m.size===row.size);if(match&&await sha(join(previous,'objects',row.object_key))===row.sha256){try{await link(join(previous,'objects',row.object_key),dest);}catch(e){if(e.code!=='EXDEV')throw e;await copyFile(join(previous,'objects',row.object_key),dest);}reusedObjects++;}else await pipeline(await provider.read(row.object_key),createWriteStream(dest,{flags:'wx',mode:0o600}));if(await sha(dest)!==row.sha256)throw new Error('备份媒体校验失败');}
  await chmod(join(temp,'database.dump'),0o600);
  return {counts,migrations,reusedObjects,version:2,format:'postgres-custom',schema:db.schema,createdAt:new Date().toISOString(),databaseSha256:await sha(join(temp,'database.dump')),media:rows};
 },{isolation:'REPEATABLE READ'});
 await writeFile(join(temp,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});await rename(temp,target);return manifest;
 }catch(e){await rm(temp,{recursive:true,force:true});throw e;}
}
export async function restoreData(source,{connectionString,uploads}){
 source=resolve(source);uploads=resolve(uploads);await absent(uploads);
 const manifest=JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
 if(manifest.version!==2||!/^[a-z][a-z0-9_]{0,62}$/.test(manifest.schema)||await sha(join(source,'database.dump'))!==manifest.databaseSha256)throw new Error('数据库备份校验失败');
 for(const m of manifest.media){if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(m.object_key)||await sha(join(source,'objects',m.object_key))!==m.sha256)throw new Error('媒体备份校验失败');}
 const db=openDatabase({connectionString,schema:manifest.schema});let restored=false;
 try{
 if((await db.one("SELECT count(*) AS n FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")).n)throw new Error('恢复仅允许新的空数据库，禁止覆盖当前数据');
 await pgTool('pg_restore',['--dbname='+new URL(connectionString).pathname.slice(1),'--single-transaction','--exit-on-error','--no-owner','--no-privileges',join(source,'database.dump')],connectionString);restored=true;
 const provider=storageProvider(uploads);for(const m of manifest.media)await provider.put(m.object_key,createReadStream(join(source,'objects',m.object_key)),{size:m.size,mime:m.mime});
 await migrate(db);for(const [table,count] of Object.entries(manifest.counts)){if(!['content','product_skus','accounts','visitors','sessions','slots','bookings','changes','consultations','idempotency','media','audit','migrations'].includes(table))throw new Error('恢复清单表名无效');if((await db.one('SELECT count(*) n FROM '+table)).n!==count)throw new Error('恢复记录数量不符');}await db.execute('DELETE FROM sessions');
 return {schema:manifest.schema,mediaCount:manifest.media.length,sessionsInvalidated:true};
 }catch(e){if(restored)throw new Error('恢复目标需隔离核查：数据库已恢复但后续验证未完成；禁止用于业务');throw e;}finally{await db.close();}
}
