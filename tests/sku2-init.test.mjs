import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import net from 'node:net';
import {openDatabase} from './pg-test-db.mjs';
test('PG runtime seed=none requires migrated schema and does not automatically create business data or admin',async t=>{
 const db=await openDatabase();t.after(()=>db.close());
 const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>r(port));});});
 const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,DATABASE_URL:db.connectionString,PGSCHEMA:db.schema,APP_ENV:'development',HQ_SEED_MODE:'none',LOCAL_DEV_AUTH:'false',PORT:String(port)},stdio:['ignore','pipe','pipe']});
 t.after(()=>{if(!child.killed)child.kill('SIGTERM');});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',d=>{if(String(d).includes('业务服务已启动')){clearTimeout(timer);resolve();}});child.on('exit',code=>{clearTimeout(timer);reject(Error('unexpected startup exit '+code));});});
 assert.equal((await fetch('http://127.0.0.1:'+port+'/api/health')).status,200);
 assert.equal((await fetch('http://127.0.0.1:'+port+'/api/auth/development',{method:'POST'})).status,403);
 await new Promise(r=>{child.once('exit',r);child.kill('SIGTERM');});
 for(const table of ['content','product_skus','consultations','bookings','slots','media','accounts','audit'])assert.equal((await db.one(`SELECT count(*) n FROM ${table}`)).n,0);
 assert.equal((await db.one('SELECT max(version) n FROM migrations')).n,1);
});
