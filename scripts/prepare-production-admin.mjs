// Build the existing Admin for root static hosting, independently of Node's /admin/ path.
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
export function prepareProductionAdmin(destination=join(root,'build/production-admin-static')){
 const dir=resolve(destination),archive=dir+'.zip';
 if(!dir.startsWith(resolve(root,'build')+'/')||existsSync(dir)||existsSync(archive))throw Error('NEW_BUILD_DIRECTORY_REQUIRED');
 execFileSync(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'build','admin','--base','/','--outDir',dir],{cwd:root,stdio:'pipe',env:{...process.env,VITE_ADMIN_API_BASE:'/api/admin/'}});
 const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(p,e.name)):[relative(dir,join(p,e.name))]);
 const files=walk(dir).sort(),html=readFileSync(join(dir,'index.html'),'utf8');
 if(files.length!==5||!files.every(f=>f==='index.html'||/^assets\/[a-zA-Z0-9_.-]+\.(js|css|png)$/.test(f)))throw Error('ADMIN_STATIC_ALLOWLIST');
 const refs=[...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(x=>x[1]);
 if(refs.length!==2||refs.some(p=>!p.startsWith('/assets/')||!files.includes(p.slice(1))))throw Error('ADMIN_STATIC_REFERENCES');
 execFileSync('zip',['-q',archive,...files],{cwd:dir,stdio:'pipe'});
 const manifest={format:1,hostingBase:'/',apiBase:'/api/admin',sameOrigin:true,cloudDeploymentExecuted:false,files:Object.fromEntries(files.map(f=>[f,sha(readFileSync(join(dir,f)))]))};
 writeFileSync(dir+'.manifest.json',JSON.stringify(manifest,null,2)+'\n');
 return {archive,bytes:readFileSync(archive).length,sha256:sha(readFileSync(archive)),manifest};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(prepareProductionAdmin(process.argv[2]),null,2));
