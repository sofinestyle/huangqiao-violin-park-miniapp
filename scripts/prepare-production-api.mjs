// Creates only the reviewed overlay archive. Never contacts CloudBase or a DB.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,lstatSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
export const files=['server/config.mjs','server/http.mjs','server/production-access.mjs','server/pg/foundation.mjs'];
const hash=b=>createHash('sha256').update(b).digest('hex');
export function prepareProductionOverlay(destination=join(root,'build/production-api')){
 const dir=resolve(destination);if(!dir.startsWith(resolve(root,'build')+'/')||existsSync(dir)||existsSync(dir+'.zip'))throw Error('NEW_BUILD_DIRECTORY_REQUIRED');
 const manifest={format:1,baseDigest:'sha256:dae4986644a1026746af37702e99be1acd6446677da4559dcc2a42344253631a',envId:'huangqiao-staging-d2d1dj1bb4ad90',serverName:'huangqiao-api',files:{},databaseMigration:false,businessDataBundled:false,cloudDeploymentExecuted:false};
 for(const p of files){if(lstatSync(join(root,p)).isSymbolicLink())throw Error('SOURCE_SYMLINK');manifest.files[p]=hash(readFileSync(join(root,p)));}
 const dockerfile=readFileSync(join(root,'deployment/inplace-promotion/Dockerfile'));
 manifest.dockerfileSha256=hash(dockerfile);mkdirSync(dir,{recursive:true});
 for(const p of files){mkdirSync(dirname(join(dir,p)),{recursive:true});copyFileSync(join(root,p),join(dir,p));}
 writeFileSync(join(dir,'Dockerfile'),dockerfile);writeFileSync(join(dir,'OVERLAY_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
 const archive=dir+'.zip';execFileSync('zip',['-q',archive,'Dockerfile',...files,'OVERLAY_MANIFEST.json'],{cwd:dir,stdio:'pipe'});
 return {directory:dir,archive,sha256:hash(readFileSync(archive)),bytes:readFileSync(archive).length,manifest};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(prepareProductionOverlay(process.argv[2]),null,2));
