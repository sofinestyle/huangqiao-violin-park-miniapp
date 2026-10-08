// Isolated PostgreSQL test lifecycle. Named fixture directories may reopen the same
// schema; this is not a SQLite compatibility adapter and accepts only native PG SQL.
import {randomUUID} from 'node:crypto';
import {after} from 'node:test';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {openPostgres,migrate} from '../server/pg/database.mjs';
import {backupData as backup,restoreData as restore} from '../server/backup.mjs';
const fixtures=new Map(),owned=[],pools=new Set(),databases=[];
export function testConnection(){if(process.env.APP_ENV&&process.env.APP_ENV!=='development')throw new Error('测试仅允许development');const connectionString=process.env.TEST_DATABASE_URL;if(!connectionString)throw new Error('须提供专用TEST_DATABASE_URL');const u=new URL(connectionString);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||!/^\/hq_test_[a-z0-9_]+$/.test(u.pathname))throw new Error('拒绝共享测试库');return connectionString;}
export async function openDatabase(path=':memory:'){
 let config=path===':memory:'?null:fixtures.get(resolve(path));
 if(!config&&path!==':memory:'&&existsSync(join(dirname(path),'.pg-fixture.json'))){config={...JSON.parse(readFileSync(join(dirname(path),'.pg-fixture.json'))),connectionString:testConnection()};owned.push(config);fixtures.set(resolve(path),config);}
 if(!config){config={connectionString:testConnection(),schema:'test_'+randomUUID().replaceAll('-','')};owned.push(config);if(path!==':memory:')fixtures.set(resolve(path),config);}
 const db=openPostgres({...config,max:12});await migrate(db);pools.add(db);const close=db.close;let closed=false;db.close=async()=>{if(!closed){closed=true;pools.delete(db);await close();}};db.connectionString=config.connectionString;return db;
}
export async function backupData(source,target){const config=fixtures.get(resolve(join(source,'fixture.pg')));if(!config)throw new Error('未注册的隔离备份源');const db=openPostgres(config);const storage=join(source,'uploads');mkdirSync(storage,{recursive:true});try{return await backup({db,connectionString:config.connectionString,storage},target);}finally{await db.close();}}
export async function backupFixture(db,uploads,target){mkdirSync(uploads,{recursive:true});return backup({db,connectionString:db.connectionString,storage:uploads},target);}
export async function restoreData(source,target){
 if(existsSync(target))throw new Error('禁止覆盖现有目标');
 const name='hq_test_restore_'+randomUUID().replaceAll('-',''),u=new URL(testConnection()),control=openPostgres({connectionString:testConnection()});
 try{await control.query('CREATE DATABASE '+name);}finally{await control.close();}
 u.pathname='/'+name;databases.push(u.toString());
 const result=await restore(source,{connectionString:u.toString(),uploads:join(target,'uploads')});
 fixtures.set(resolve(join(target,'fixture.pg')),{connectionString:u.toString(),schema:result.schema});return result;
}
after(async()=>{for(const db of pools)await db.close();for(const config of owned){const db=openPostgres(config);try{await db.query('DROP SCHEMA IF EXISTS '+config.schema+' CASCADE');}finally{await db.close();}}for(const url of databases){const db=openPostgres({connectionString:testConnection()});try{await db.query('DROP DATABASE '+new URL(url).pathname.slice(1)+' WITH (FORCE)');}finally{await db.close();}}});
