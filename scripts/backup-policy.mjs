// Planning only: this command never deletes backups or business data.
import {readFileSync,readdirSync,lstatSync} from 'node:fs';import {resolve,join} from 'node:path';
const positive=(name,fallback)=>{const n=Number(process.env[name]||fallback);if(!Number.isInteger(n)||n<1)throw new Error(name+'须为正整数');return n;};
const policy={databaseIntervalDays:positive('DB_BACKUP_INTERVAL_DAYS',3),imagesIntervalDays:positive('IMAGE_BACKUP_INTERVAL_DAYS',7),retentionDays:positive('BACKUP_RETENTION_DAYS',30)};
const root=resolve(process.argv[2]||'backups'),sets=[];for(const name of readdirSync(root)){const path=join(root,name);if(lstatSync(path).isSymbolicLink()||!lstatSync(path).isDirectory())continue;try{const m=JSON.parse(readFileSync(join(path,'manifest.json')));if(m.version===2&&m.format==='postgres-custom')sets.push({name,createdAt:m.createdAt,ageDays:(Date.now()-Date.parse(m.createdAt))/864e5});}catch{}}
console.log(JSON.stringify({dryRun:true,policy,sets,retentionCandidates:sets.filter(s=>s.ageDays>policy.retentionDays).map(s=>s.name),note:'清理仅限核验后备份集；不得删除业务库或媒体源。增量备份使用独立硬链接文件集，不依赖其它备份目录。'},null,2));
