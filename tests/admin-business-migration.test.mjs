import test from 'node:test';import assert from 'node:assert/strict';
import {openDatabase} from './pg-test-db.mjs';import {migrate} from '../server/db.mjs';
test('PG audit indexes preserve rows, repeat migration is idempotent and failed DDL rolls back',async t=>{
 const db=await openDatabase();t.after(()=>db.close());await db.execute("INSERT INTO audit(actor,action,object,detail,created_at) VALUES('synthetic','check','x','{}',now())");const rows=await db.many('SELECT * FROM audit');
 const names=async()=> (await db.many("SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename='audit' ORDER BY indexname")).map(x=>x.indexname);
 for(const n of ['audit_action_created_at_id','audit_actor_created_at_id','audit_created_at_id'])assert.ok((await names()).includes(n));
 await migrate(db);assert.deepEqual(await db.many('SELECT * FROM audit'),rows);
 await assert.rejects(db.transaction(async()=>{await db.query('DROP INDEX audit_created_at_id');throw Error('rollback');}),/rollback/);
 assert.ok((await names()).includes('audit_created_at_id'));assert.deepEqual(await db.many('SELECT * FROM audit'),rows);
});
