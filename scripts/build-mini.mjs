// Build an isolated, explicit environment package; never modify the developer project.
import {cpSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';import {execFileSync} from 'node:child_process';
const environment=process.env.APP_ENV||'development';if(!['development','staging','production'].includes(environment))throw new Error('APP_ENV无效');
const base=process.env.MINI_API_BASE||(environment==='development'?'http://127.0.0.1:8787':'');
let u;try{u=new URL(base);}catch{throw new Error('须明确配置MINI_API_BASE');}
if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(environment!=='development'&&(u.protocol!=='https:'||['127.0.0.1','localhost'].includes(u.hostname))))throw new Error('小程序API须为无凭据的环境HTTPS Origin');
if(environment!=='development'&&!/^wx[a-f0-9]{16}$/.test(process.env.MINI_APPID||''))throw new Error('须明确配置MINI_APPID，不能把测试AppID作为正式环境包');
const out=resolve('build/mini-'+environment);rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
cpSync('miniprogram',out,{recursive:true,filter:p=>!p.endsWith('project.private.config.json')&&!p.endsWith('.DS_Store')&&!p.endsWith('.js')&&!p.endsWith('.js.map')});
if(environment!=='development'){const project=JSON.parse(readFileSync(join(out,'project.config.json'),'utf8'));project.appid=process.env.MINI_APPID;writeFileSync(join(out,'project.config.json'),JSON.stringify(project,null,2)+'\n');}
writeFileSync(join(out,'miniprogram/config.ts'),`// Generated ${environment} package. No secrets.\nexport const API_BASE = ${JSON.stringify(u.origin)};\nexport const IDENTITY_MODE: 'development' | 'wechat' = ${JSON.stringify(environment==='development'?'development':'wechat')};\n`);
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','-p',join(out,'tsconfig.json')],{stdio:'inherit'});
console.log(`小程序环境包已生成并通过Type Check：${out}；原生编译/预览仍需微信开发者工具。`);
