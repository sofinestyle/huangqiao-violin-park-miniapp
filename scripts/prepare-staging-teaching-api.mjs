// Create a credentials-free, two-file overlay package; this script never deploys.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const root=fileURLToPath(new URL('../',import.meta.url));
export const overlay={
 environment:'staging',envId:'huangqiao-staging-d2d1dj1bb4ad90',serverName:'huangqiao-api',
 baseImage:'ccr.ccs.tencentyun.com/tcb-100011456753-gqyp/ca-pppfmzdq_huangqiao-api@sha256:3666e8ebf4544ca0ee84836945f1a064deffed9d6b476d08f80854a690fc24bd',
 files:{'server/pg/foundation.mjs':'9394c4ae6735de1c9eae69323ea6de86e28a505f447f995f0392337e523ae578','shared/teaching-types.mjs':'2def6a2d793b7974a9a3c7f790cb531e06c70eceb1dc4e1fc4a9323a92dbbec8'}
};
export function prepareOverlay(destination=join(root,'build/staging-teaching-api')){
 const dir=resolve(destination);
 if(!dir.startsWith(resolve(root,'build')+'/')||existsSync(dir)||existsSync(dir+'.zip'))throw Error('NEW_BUILD_DIRECTORY_REQUIRED');
 const hashes=Object.fromEntries(Object.entries(overlay.files).map(([path,expected])=>{
  const actual=createHash('sha256').update(readFileSync(join(root,path))).digest('hex');
  if(actual!==expected)throw Error('OVERLAY_SOURCE_CHANGED');
  return [path,actual];
 }));
 mkdirSync(dir,{recursive:true});
 for(const path of Object.keys(overlay.files)){mkdirSync(dirname(join(dir,path)),{recursive:true});copyFileSync(join(root,path),join(dir,path));}
 copyFileSync(join(root,'deployment/staging-teaching-type/Dockerfile'),join(dir,'Dockerfile'));
 const manifest={...overlay,files:hashes,configChanges:[],databaseMigration:false,automaticClassification:false};
 writeFileSync(join(dir,'OVERLAY_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
 const archive=dir+'.zip';
 execFileSync('zip',['-q',archive,'Dockerfile','server/pg/foundation.mjs','shared/teaching-types.mjs','OVERLAY_MANIFEST.json'],{cwd:dir,stdio:'pipe'});
 return {directory:dir,archive,sha256:createHash('sha256').update(readFileSync(archive)).digest('hex'),manifest};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(prepareOverlay(process.argv[2]),null,2));
