// Standalone selective import. Never called by Runtime/seed/migrations.
import {readFile, mkdir, appendFile, lstat, rmdir, realpath} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openPostgres} from '../server/pg/database.mjs';
import {CloudBaseStorage} from '../server/storage/index.mjs';
import {canonical, digest, validateManifest, runMigration, pgTarget} from './guide-migration/core.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=resolve(root,'docs/deployment/phase-2c/guide-manifest.json');
export function parseArgs(args) {
  const out={execute:false};let mode;
  for(const a of args) {
    if(a==='--dry-run'||a==='--execute'){if(mode)throw Error('MODE_DUPLICATE');mode=a;out.execute=a==='--execute';}
    else if(a.startsWith('--category=')&&!out.category)out.category=a.slice(11);
    else if(a.startsWith('--target-snapshot=')&&!out.snapshot)out.snapshot=a.slice(18);
    else if(a.startsWith('--confirm-manifest=')&&!out.confirm)out.confirm=a.slice(19);
    else throw Error('ARGUMENT_INVALID');
  }
  if(out.category!=='guide')throw Error('CATEGORY_GUIDE_REQUIRED');
  if(out.execute&&out.snapshot)throw Error('EXECUTE_REQUIRES_LIVE_TARGET');return out;
}
export function targetConfig(env,m) {
  if(env.APP_ENV!=='staging'||env.PGSCHEMA!=='app')throw Error('STAGING_APP_SCHEMA_REQUIRED');
  let u;try{u=new URL(env.GUIDE_DATABASE_URL);}catch{throw Error('GUIDE_DATABASE_URL_REQUIRED');}
  if(!['postgres:','postgresql:'].includes(u.protocol)||decodeURIComponent(u.pathname.slice(1))!==m.target.database||!u.username||!u.password)throw Error('TARGET_DATABASE_INVALID');
  if(!env.GUIDE_TARGET_HOST||u.hostname!==env.GUIDE_TARGET_HOST||['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('TARGET_HOST_CONFIRMATION_REQUIRED');
  if(env.CLOUDBASE_ENV_ID!==m.target.cloudbaseEnv||env.CLOUDBASE_BUCKET!==m.target.bucket)throw Error('TARGET_STORAGE_INVALID');
  return {connectionString:u.href,schema:'app',max:1};
}
async function snapshotTarget(path,m) {
  const snap=JSON.parse(await readFile(path,'utf8'));
  if(snap.manifestSha256!==digest(m)||canonical(snap.target)!==canonical(m.target)||!Number.isFinite(Date.parse(snap.checkedAt))||Date.now()-Date.parse(snap.checkedAt)>86400000||Date.parse(snap.checkedAt)>Date.now()+60000)throw Error('SNAPSHOT_INVALID_OR_STALE');
  if(!Array.isArray(snap.content)||!Array.isArray(snap.media)||!Number.isSafeInteger(snap.counts?.content)||!Number.isSafeInteger(snap.counts?.media))throw Error('SNAPSHOT_SHAPE_INVALID');
  for(const r of [...snap.content,...snap.media])for(const k of ['created_at','updated_at'])if(r[k])r[k]=new Date(r[k]).toISOString();
  return {inspect:async()=>snap};
}
async function journal(m) {
  // Refuse symlinks, append-only local records, and concurrent CLI executions.
  const base=resolve(root,'.local'),dir=resolve(base,'guide-migration');
  for(const p of [base,dir]){await mkdir(p,{recursive:true,mode:0o700});if((await lstat(p)).isSymbolicLink()||await realpath(p)!==p)throw Error('JOURNAL_SYMLINK_REFUSED');}
  const lock=resolve(dir,digest(m)+'.lock'),file=resolve(dir,digest(m)+'.jsonl');
  try {if((await lstat(file)).isSymbolicLink())throw Error('JOURNAL_SYMLINK_REFUSED');}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(lock,{mode:0o700});
  return {record:entry=>appendFile(file,JSON.stringify({at:new Date().toISOString(),manifestSha256:digest(m),...entry})+'\n',{mode:0o600}),close:()=>rmdir(lock)};
}
export async function main(args=process.argv.slice(2),env=process.env) {
  const options=parseArgs(args),m=JSON.parse(await readFile(manifestPath,'utf8'));validateManifest(m);
  if(options.execute&&options.confirm!==digest(m))throw Error('MANIFEST_CONFIRMATION_REQUIRED');
  let db,target,storage,log;
  try {
    if(options.snapshot)target=await snapshotTarget(options.snapshot,m);
    else if(env.GUIDE_DATABASE_URL||options.execute){
      db=openPostgres(targetConfig(env,m));
      const identity=await db.one('SELECT current_database() AS database,current_schema() AS schema');
      if(identity.database!==m.target.database||identity.schema!=='app')throw Error('TARGET_IDENTITY_MISMATCH');
      target=pgTarget(db,m);
    }
    if(options.execute){
      storage=new CloudBaseStorage({envId:env.CLOUDBASE_ENV_ID,bucket:env.CLOUDBASE_BUCKET,token:env.CLOUDBASE_SERVICE_ROLE_KEY});log=await journal(m);
    }
    const report=await runMigration({root,manifest:m,target,storage,execute:options.execute,record:log?.record});
    console.log(JSON.stringify(report,null,2));return report;
  } finally {if(log)await log.close();if(db)await db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{
  // Driver/provider messages may include hosts/credentials: output codes only.
  console.error(JSON.stringify({status:'STOPPED',code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:/^[A-Z0-9_]+$/.test(e.message||'')?e.message:'MIGRATION_FAILED',action:'保留运行日志，核对来源/目标；禁止自动清理对象'}));process.exitCode=1;
});
