// Devtools stores custom compile conditions in its ignored private configuration.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const shared=JSON.parse(readFileSync('miniprogram/project.config.json','utf8'));
const path='miniprogram/project.private.config.json';
const local=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
local.condition ||= {};
local.condition.miniprogram ||= {};
const modes=shared.condition.miniprogram.list;
const existing=local.condition.miniprogram.list || [];
local.condition.miniprogram.list=[...existing.filter(x=>!modes.some(m=>m.name===x.name)),...modes].map((x,id)=>({...x,id}));
writeFileSync(path,JSON.stringify(local,null,2)+'\n');
console.log('已准备 Development · 本地 / Staging · 云端编译模式；保留原本安全与个人设置。');
