import {spawn,execFileSync} from 'node:child_process';import {resolve} from 'node:path';import net from 'node:net';
import {ensureLocalPostgres,assertLocalTarget,root} from './local-development/runtime.mjs';
const env=await ensureLocalPostgres();console.log('Local Development PostgreSQL',assertLocalTarget(env));
const children=[];let stopping=false;
const stop=()=>{if(stopping)return;stopping=true;children.forEach(p=>p.kill('SIGTERM'));};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
const run=(args)=>{const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},stdio:'inherit'});children.push(child);child.on('exit',code=>{if(!stopping){stop();process.exitCode=code||1;}});return child;};
const portBusy=port=>new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.setTimeout(1500,()=>{s.destroy();resolve(false);});});
if(await portBusy(Number(env.PORT)))throw Error('本地API端口'+env.PORT+'已使用；请先关闭原开发进程，不自动覆盖');
if(process.argv.includes('--server-only'))run(['--watch','server/index.mjs']);
else{
 if(await portBusy(5173)){
  const pids=execFileSync('lsof',['-t','-iTCP:5173','-sTCP:LISTEN'],{encoding:'utf8'}).trim().split('\n');
  if(!pids.every(pid=>execFileSync('lsof',['-a','-p',pid,'-d','cwd','-Fn'],{encoding:'utf8'}).includes('\nn'+resolve(root).replace(/\/$/,'')+'\n')))throw Error('后台端口5173由其他项目使用，启动已停止');
  console.log('复用本项目已有本地后台5173；不停止用户已有进程。');
 }else run(['node_modules/vite/bin/vite.js','admin','--host','127.0.0.1','--port','5173','--strictPort']);
 run(['--watch','server/index.mjs']);
}
