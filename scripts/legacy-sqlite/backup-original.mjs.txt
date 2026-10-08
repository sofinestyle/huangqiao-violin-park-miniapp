import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, chmodSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { digest } from './security.mjs';
const sha=path=>digest(readFileSync(path));
export function backupData(source,target) {
  source=resolve(source);target=resolve(target);
  if(existsSync(target))throw new Error('备份目标已存在，禁止覆盖');
  const temp=`${target}.partial-${Date.now()}`;mkdirSync(join(temp,'uploads'),{recursive:true,mode:0o700});
  try {
    const db=new DatabaseSync(join(source,'huangqiao.sqlite'));
    try{db.exec(`VACUUM INTO '${join(temp,'huangqiao.sqlite').replaceAll("'","''")}'`);}finally{db.close();}
    const snapshot=new DatabaseSync(join(temp,'huangqiao.sqlite'),{readOnly:true});
    let rows;try{rows=snapshot.prepare('SELECT * FROM media').all();}finally{snapshot.close();}
    const files=[];
    for(const m of rows){const from=join(source,'uploads',m.stored_name),to=join(temp,'uploads',m.stored_name);if(sha(from)!==m.sha256)throw new Error(`媒体校验失败：${m.id}`);copyFileSync(from,to);chmodSync(to,0o600);files.push({id:m.id,name:m.stored_name,sha256:m.sha256,size:m.size});}
    chmodSync(join(temp,'huangqiao.sqlite'),0o600);
    const manifest={version:1,createdAt:new Date().toISOString(),databaseSha256:sha(join(temp,'huangqiao.sqlite')),media:files};
    writeFileSync(join(temp,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});renameSync(temp,target);return manifest;
  }catch(e){rmSync(temp,{recursive:true,force:true});throw e;}
}
export function restoreData(source,target) {
  source=resolve(source);target=resolve(target);
  if(existsSync(target))throw new Error('恢复仅允许新的空目标路径，禁止覆盖当前数据');
  const manifest=JSON.parse(readFileSync(join(source,'manifest.json'),'utf8'));
  if(manifest.version!==1 || sha(join(source,'huangqiao.sqlite'))!==manifest.databaseSha256)throw new Error('数据库备份校验失败');
  for(const m of manifest.media){if(!/^[a-zA-Z0-9.-]+$/.test(m.name) || sha(join(source,'uploads',m.name))!==m.sha256)throw new Error('媒体备份校验失败');}
  const temp=`${target}.partial-${Date.now()}`;mkdirSync(join(temp,'uploads'),{recursive:true,mode:0o700});
  try {
    copyFileSync(join(source,'huangqiao.sqlite'),join(temp,'huangqiao.sqlite'));chmodSync(join(temp,'huangqiao.sqlite'),0o600);
    for(const m of manifest.media){copyFileSync(join(source,'uploads',m.name),join(temp,'uploads',m.name));chmodSync(join(temp,'uploads',m.name),0o600);}
    const db=new DatabaseSync(join(temp,'huangqiao.sqlite'));
    try{if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok' || db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('恢复后的数据库完整性检查失败');db.exec('DELETE FROM sessions');}finally{db.close();}
    renameSync(temp,target);return {target,mediaCount:manifest.media.length,sessionsInvalidated:true};
  }catch(e){rmSync(temp,{recursive:true,force:true});throw e;}
}
