// Deliberately cannot reset the shared development directory. Only a marked temp fixture.
import {mkdtempSync,realpathSync,existsSync,readFileSync,writeFileSync,rmSync,readdirSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,basename,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../server/db.mjs';
import {seed} from '../server/seed.mjs';
import {seedSkuProducts} from '../server/sku-seed.mjs';
const marker='.sku-isolated-development';
export async function resetSkuDev({target,create=false,confirm=false,dryRun=false,environment}={}){
 if(environment!=='development')throw new Error('仅允许development隔离环境');
 if(create&&dryRun)throw new Error('dry-run须指定已有隔离目录，不创建新目录');
 if(create){target=mkdtempSync(join(realpathSync(tmpdir()),'hq-sku-isolated-'));writeFileSync(join(target,marker),'sku-test-only\n',{mode:0o600});}
 if(!target)throw new Error('使用--new创建隔离环境，禁止默认共享路径');
 const raw=resolve(target),dir=realpathSync(raw),temp=realpathSync(tmpdir());
 if(raw!==dir || dirname(dir)!==temp || !basename(dir).startsWith('hq-sku-isolated-') || !existsSync(join(dir,marker)) || readFileSync(join(dir,marker),'utf8')!=='sku-test-only\n')throw new Error('拒绝非专用临时环境、符号链接或共享开发目录');
 const scan=path=>{if(lstatSync(path).isSymbolicLink())throw new Error('拒绝符号链接');if(lstatSync(path).isDirectory())for(const name of readdirSync(path))scan(join(path,name));};scan(dir);
 const connectionString=process.env.TEST_DATABASE_URL;let url;try{url=new URL(connectionString);}catch{throw new Error('须配置专用TEST_DATABASE_URL');}
 if(!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/hq_test_[a-z0-9_]+$/.test(url.pathname))throw new Error('拒绝共享/生产数据库');
 const configPath=join(dir,'.pg-fixture.json'),schema=existsSync(configPath)?JSON.parse(readFileSync(configPath)).schema:'test_'+randomUUID().replaceAll('-','');
 if(!/^test_[a-f0-9]{32}$/.test(schema))throw new Error('拒绝非隔离Schema');
 const plan={schema,directory:dir,environment,dryRun,scope:['专用本机PostgreSQL隔离Schema','隔离上传文件','临时测试内容/SKU/咨询/预约/场次/账号/审计；重新生成isTest资料'],files:readdirSync(dir).filter(n=>n!==marker)};
 console.log(JSON.stringify({resetPlan:plan}));
 if(dryRun)return plan;
 if(!create&&!confirm)throw new Error('重建隔离测试库需要--confirm-reset');
 const db=openDatabase({connectionString,schema});
 try{
  await db.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await migrate(db);
  for(const name of readdirSync(dir))if(name!==marker)rmSync(join(dir,name),{recursive:true,force:true});
  writeFileSync(configPath,JSON.stringify({schema}),{mode:0o600});
  await seed(db);return {directory:dir,schema,products:(await seedSkuProducts(db)).length,isTest:true};
 }finally{await db.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{const a=process.argv.slice(2);console.log(JSON.stringify(await resetSkuDev({create:a.includes('--new'),target:a.includes('--dir')?a[a.indexOf('--dir')+1]:undefined,confirm:a.includes('--confirm-reset'),dryRun:a.includes('--dry-run'),environment:process.env.APP_ENV})));}catch(e){console.error(e.message);process.exitCode=1;}
}
