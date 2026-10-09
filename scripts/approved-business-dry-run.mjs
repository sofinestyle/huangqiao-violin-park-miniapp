// Usage: node scripts/approved-business-dry-run.mjs; only reads the approved local PG and exported Staging evidence.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runtimeEnvironment,assertLocalTarget} from './local-development/runtime.mjs';
import {openPostgres} from '../server/pg/database.mjs';
import {buildPlan,hash,moduleOf} from './business-migration/plan.mjs';
import {executionSql} from './business-migration/sql.mjs';
const dir=resolve('.local/approved-business-migration'),read=p=>JSON.parse(readFileSync(p,'utf8'));mkdirSync(dir,{recursive:true,mode:0o700});
const env=runtimeEnvironment();assertLocalTarget(env);const db=openPostgres({connectionString:env.DATABASE_URL,schema:env.PGSCHEMA,max:1});
try{
 const source=await db.transaction(async()=>({checkedAt:new Date().toISOString(),identity:await db.one('SELECT inet_server_addr()::text host,inet_server_port() port,current_database() database,current_user runtime_user,current_schema() schema'),content:await db.many('SELECT * FROM content ORDER BY sort,id'),media:await db.many('SELECT * FROM media ORDER BY id'),skus:await db.many('SELECT * FROM product_skus ORDER BY product_id,sort_order,id')}),{isolation:'REPEATABLE READ'});
 const plan=buildPlan(source,read(dir+'/staging-before.json'),read(dir+'/protected-before.json'),read('docs/deployment/phase-2c/guide-manifest.json'),{root:process.cwd(),uploadDir:dir+'/upload',systemAssetMappings:read('docs/deployment/phase-2d/system-asset-verification.json').systemAssetMappings});
 const save=(p,x)=>writeFileSync(p,typeof x==='string'?x:JSON.stringify(x,null,2)+'\n',{mode:0o600});save(dir+'/source-current.json',source);save(dir+'/plan.json',plan);
 const modules=['site','spot','instrument','cultural','study','teaching'];const report={sourceTime:source.checkedAt,targetTime:read(dir+'/staging-before.json').checkedAt,source:source.identity,summary:plan.summary,sourceInventory:modules.map(module=>{const rows=source.content.filter(r=>moduleOf(r)===module);return {module,count:rows.length,states:Object.fromEntries([...new Set(rows.map(r=>r.state))].map(state=>[state,rows.filter(r=>r.state===state).length]))};}),APPROVED:plan.approved,ALREADY_MIGRATED:plan.alreadyMigrated,SKIPPED_VIDEO:plan.skippedVideo,MANUAL_REVIEW:plan.manualReview,CONFLICT:plan.conflicts,MEDIA_TO_UPLOAD:plan.media.filter(m=>m.action==='MEDIA_TO_UPLOAD').map(({sourcePath,uploadPath,...r})=>r),MEDIA_REUSE:plan.media.filter(m=>m.action==='MEDIA_REUSE'),SKIPPED_VIDEO_FILES:plan.skippedVideoFiles,specMappings:plan.specMappings,urlMappings:plan.urlMappings,guideMedia:plan.guideMedia,planHash:hash(plan),executed:false};
 mkdirSync('docs/deployment/phase-2d',{recursive:true});save('docs/deployment/phase-2d/dry-run.json',report);
 if(!plan.conflicts.length){save(dir+'/execute.sql',executionSql(plan));mkdirSync(dir+'/upload',{recursive:true,mode:0o700});for(const m of plan.media.filter(m=>m.action==='MEDIA_TO_UPLOAD')){copyFileSync(m.sourcePath,m.uploadPath);if(hash(readFileSync(m.uploadPath))!==m.sha256)throw Error('PREPARED_UPLOAD_CHANGED');}}
 console.log(JSON.stringify({summary:plan.summary,approvedByModule:Object.fromEntries(modules.map(m=>[m,plan.approved.filter(x=>x.module===m).length])),manualReview:plan.manualReview,planHash:hash(plan),executed:false},null,2));
}finally{await db.close();}
