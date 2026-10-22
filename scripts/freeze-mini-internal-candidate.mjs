// Freeze a verified trial candidate outside the build directory used by tests.
import {readFileSync,readdirSync,existsSync,lstatSync,cpSync,rmSync,writeFileSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';import vm from 'node:vm';
const root=fileURLToPath(new URL('../',import.meta.url)),base=resolve(root,'build')+'/';
const sha=b=>createHash('sha256').update(b).digest('hex');
function files(dir){const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>{const f=join(p,e.name);if(lstatSync(f).isSymbolicLink())throw Error('CANDIDATE_SYMLINK');return e.isDirectory()?walk(f):[relative(dir,f)];});return Object.fromEntries(walk(dir).sort().filter(f=>!f.endsWith('project.private.config.json')&&!f.endsWith('.DS_Store')).map(f=>[f,sha(readFileSync(join(dir,f)))]));}
function configuration(dir){
 if(existsSync(join(dir,'PREPARATION_ONLY.json'))||!existsSync(join(dir,'INTERNAL_CANDIDATE.json')))throw Error('INTERNAL_CANDIDATE_REQUIRED');
 const meta=JSON.parse(readFileSync(join(dir,'INTERNAL_CANDIDATE.json'))),project=JSON.parse(readFileSync(join(dir,'project.config.json')));
 const load=file=>{const module={exports:{}};vm.runInNewContext(readFileSync(join(dir,'miniprogram',file),'utf8'),{module,exports:module.exports},{timeout:1000});return module.exports.default;};
 const target=load('build-target.js'),settings=load('environment-settings.js');
 if(meta.environment!=='production'||meta.runtimeEnabled!==true||meta.uploadApproved!==true||meta.uploadPurpose!=='internal-experience-only'||meta.reviewApproved!==false||meta.releaseApproved!==false||meta.apiBase!=='https://admin.yorray.com'||project.appid!=='wx5dee6ef3087366c0'||project.setting?.urlCheck!==true||project.setting?.minified!==true||target?.environment!=='production'||settings?.production?.enabled!==true||settings.production.apiBase!==meta.apiBase)throw Error('INTERNAL_CANDIDATE_RUNTIME_GUARD');
 return meta;
}
export function freezeMiniCandidate(source,destination){
 const src=resolve(source),dir=resolve(destination);
 if(!src.startsWith(base)||!dir.startsWith(base)||src===dir||dir.startsWith(src+'/')||existsSync(dir)||existsSync(dir+'.manifest.json'))throw Error('NEW_ISOLATED_CANDIDATE_REQUIRED');
 configuration(src);const before=files(src);
 try{cpSync(src,dir,{recursive:true,filter:p=>!p.endsWith('project.private.config.json')&&!p.endsWith('.DS_Store')});configuration(dir);if(JSON.stringify(before)!==JSON.stringify(files(dir)))throw Error('CANDIDATE_CHANGED_DURING_COPY');
  const manifest={format:1,appId:'wx5dee6ef3087366c0',environment:'production',apiBase:'https://admin.yorray.com',files:before,sha256:sha(JSON.stringify(before)),reviewApproved:false,releaseApproved:false};writeFileSync(dir+'.manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return {directory:dir,manifest};
 }catch(e){rmSync(dir,{recursive:true,force:true});throw e;}
}
export function verifyFrozenCandidate(destination){const dir=resolve(destination);if(!dir.startsWith(base))throw Error('BUILD_DIRECTORY_REQUIRED');configuration(dir);const manifest=JSON.parse(readFileSync(dir+'.manifest.json'));const current=files(dir);if(JSON.stringify(current)!==JSON.stringify(manifest.files)||sha(JSON.stringify(current))!==manifest.sha256)throw Error('FROZEN_CANDIDATE_CHANGED');return manifest;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(freezeMiniCandidate(process.argv[2],process.argv[3]),null,2));
