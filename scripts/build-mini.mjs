// Build an isolated package using the same SSOT as the native developer project.
import {cpSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import ts from 'typescript';import vm from 'node:vm';
import {resolve,join} from 'node:path';import {execFileSync} from 'node:child_process';
const environment=process.env.APP_ENV||'development';
if(environment!=='development'&&environment!=='staging')throw new Error('Production尚未批准，禁止生成正式环境包');
const module={exports:{}};
const code=ts.transpileModule(readFileSync('miniprogram/miniprogram/environment-settings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{module,exports:module.exports});
const settings=module.exports.default;
const config=settings[environment];
if(!config.enabled||!config.apiBase)throw new Error('目标环境未启用');
if(process.env.MINI_API_BASE&&process.env.MINI_API_BASE!==config.apiBase)throw new Error('MINI_API_BASE与SSOT不一致；禁止构建时覆盖API目标');
const u=new URL(config.apiBase);
if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||
 (environment==='development'&&!['127.0.0.1','localhost','[::1]'].includes(u.hostname))||
 (environment==='staging'&&(u.protocol!=='https:'||!u.hostname.endsWith('.app.tcloudbase.com'))))throw new Error('API环境边界无效');
if(environment==='staging'&&!/^wx[a-f0-9]{16}$/.test(process.env.MINI_APPID||''))throw new Error('须明确配置MINI_APPID');
const out=resolve('build/mini-'+environment);rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
cpSync('miniprogram',out,{recursive:true,filter:p=>!p.endsWith('project.private.config.json')&&!p.endsWith('.DS_Store')&&!p.endsWith('.js')&&!p.endsWith('.js.map')});
if(environment==='staging'){const project=JSON.parse(readFileSync(join(out,'project.config.json'),'utf8'));project.appid=process.env.MINI_APPID;writeFileSync(join(out,'project.config.json'),JSON.stringify(project,null,2)+'\n');}
writeFileSync(join(out,'miniprogram/build-target.ts'),'export default '+JSON.stringify({environment})+';\n');
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','-p',join(out,'tsconfig.json')],{stdio:'inherit'});
console.log(`小程序环境包已生成并通过Type Check：${out}；目标${config.label}；原生编译/预览仍需微信开发者工具。`);
