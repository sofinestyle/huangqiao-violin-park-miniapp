// Build an isolated package using the same SSOT as the native developer project.
import {cpSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import ts from 'typescript';import vm from 'node:vm';
import {resolve,join} from 'node:path';import {execFileSync} from 'node:child_process';
const environment=process.env.APP_ENV||'development';
const preparationOnly=environment==='production'&&process.argv.includes('--prepare-production');
const internalCandidate=environment==='production'&&process.argv.includes('--candidate-production');
if(!['development','staging','production'].includes(environment))throw new Error('环境无效');
if(preparationOnly&&internalCandidate)throw new Error('准备与验收候选模式不可同时选择');
if(environment==='production'&&!preparationOnly&&!internalCandidate)throw new Error('正式环境须显式选择本地准备或内部验收候选，不允许直接发布构建');
const module={exports:{}};
const code=ts.transpileModule(readFileSync('miniprogram/miniprogram/environment-settings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{module,exports:module.exports});
const settings=module.exports.default;
const config=settings[environment];
if((!config.enabled&&!preparationOnly)||!config.apiBase)throw new Error('目标环境未启用');
if(process.env.MINI_API_BASE&&process.env.MINI_API_BASE!==config.apiBase)throw new Error('MINI_API_BASE与SSOT不一致；禁止构建时覆盖API目标');
const u=new URL(config.apiBase);
if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||
 (environment==='development'&&!['127.0.0.1','localhost','[::1]'].includes(u.hostname))||
 (environment==='staging'&&(u.protocol!=='https:'||!u.hostname.endsWith('.app.tcloudbase.com')))||
 (environment==='production'&&config.apiBase!=='https://admin.yorray.com'))throw new Error('API环境边界无效');
// The shared native project is the single AppID source for every build target.
const sourceProject=JSON.parse(readFileSync('miniprogram/project.config.json','utf8'));
if(!/^wx[a-f0-9]{16}$/.test(sourceProject.appid||''))throw new Error('项目AppID无效，禁止构建');
if(process.env.MINI_APPID&&process.env.MINI_APPID!==sourceProject.appid)throw new Error('MINI_APPID与项目AppID不一致，禁止构建');
const out=resolve('build/mini-'+environment);rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
cpSync('miniprogram',out,{recursive:true,filter:p=>!p.endsWith('project.private.config.json')&&!p.endsWith('.DS_Store')&&!p.endsWith('.js')&&!p.endsWith('.js.map')});
writeFileSync(join(out,'miniprogram/build-target.ts'),'export default '+JSON.stringify({environment})+';\n');
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p',join(out,'tsconfig.json')],{stdio:'inherit'});
// Emit JavaScript before the official preview compiler consumes this isolated build.
const project=JSON.parse(readFileSync(join(out,'project.config.json'),'utf8'));
if(preparationOnly||internalCandidate){
 project.setting.minified=true;project.setting.urlCheck=true;
 project.condition={miniprogram:{list:[]}};
 const file=preparationOnly?'PREPARATION_ONLY.json':'INTERNAL_CANDIDATE.json';
 writeFileSync(join(out,file),JSON.stringify({environment,apiBase:config.apiBase,runtimeEnabled:config.enabled,uploadApproved:internalCandidate,uploadPurpose:internalCandidate?'internal-experience-only':'none',reviewApproved:false,releaseApproved:false},null,2)+'\n');
}
project.setting.useCompilerPlugins=(project.setting.useCompilerPlugins||[]).filter(name=>name!=='typescript');
writeFileSync(join(out,'project.config.json'),JSON.stringify(project,null,2)+'\n');
console.log(`小程序环境包已生成并通过Type Check：${out}；目标${config.label}；原生编译/预览仍需微信开发者工具。`);
if(preparationOnly)console.log('仅完成本地准备；未调用上传、提审或发布。运行开关：'+(config.enabled?'已启用':'未启用')+'。');
if(internalCandidate)console.log('仅供已批准的内部体验验收；不代表已提审、已发布或业务上线验收通过。');
