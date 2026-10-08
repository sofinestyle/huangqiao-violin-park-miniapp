// Offline legacy tool only. Not imported by runtime, migration or tests.
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,readFileSync,copyFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';
const [sourceArg,targetArg,sourceCommit]=process.argv.slice(2);if(!sourceArg||!targetArg||!/^[a-f0-9]{40}$/.test(sourceCommit||''))throw new Error('用法：node scripts/archive-sqlite.mjs 旧数据目录 新归档目录 基准CommitSHA');
const source=resolve(sourceArg),target=resolve(targetArg);if(existsSync(target))throw new Error('拒绝覆盖归档');
mkdirSync(join(target,'uploads'),{recursive:true,mode:0o700});
const db=new DatabaseSync(join(source,'huangqiao.sqlite'),{readOnly:true});try{await backup(db,join(target,'huangqiao.sqlite'));}finally{db.close();}
const archived=new DatabaseSync(join(target,'huangqiao.sqlite'),{readOnly:true}),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
try{const media=archived.prepare('SELECT * FROM media').all();for(const m of media){if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(m.stored_name))throw new Error('无效媒体路径');const path=join(source,'uploads',m.stored_name);if(hash(path)!==m.sha256)throw new Error('旧媒体哈希不符');copyFileSync(path,join(target,'uploads',m.stored_name));}
writeFileSync(join(target,'manifest.json'),JSON.stringify({label:'LEGACY DEVELOPMENT ARCHIVE',sourceCommit,schemaVersions:archived.prepare('SELECT version FROM migrations ORDER BY version').all().map(r=>r.version),createdAt:new Date().toISOString(),databaseSha256:hash(join(target,'huangqiao.sqlite')),media:media.map(m=>({key:m.stored_name,sha256:m.sha256,size:m.size}))},null,2),{mode:0o600});
writeFileSync(join(target,'README.txt'),'LEGACY DEVELOPMENT ARCHIVE\n只供历史开发资料追溯；不作为运行时数据库，不自动导入PostgreSQL。原库及文件未删除。\n',{mode:0o600});console.log(`SQLite开发归档完成，媒体${media.length}份；原库未清理。`);}finally{archived.close();}
