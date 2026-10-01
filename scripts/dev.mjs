import {spawn} from 'node:child_process';
const children=[];
const stop=()=>children.forEach(p=>p.kill('SIGTERM'));
process.on('SIGINT',stop);process.on('SIGTERM',stop);
const run=(cmd,args)=>{const child=spawn(cmd,args,{stdio:'inherit'});children.push(child);child.on('exit',code=>{if(code){stop();process.exitCode=code;}});return child;};
run(process.execPath,['--watch','server/index.mjs']);
run(process.execPath,['node_modules/vite/bin/vite.js','admin','--host','127.0.0.1','--port','5173','--strictPort']);
