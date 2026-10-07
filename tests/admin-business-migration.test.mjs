import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/db.mjs';
import {migrateAuditIndexes,rollbackAuditIndexes} from '../server/migrations/004-admin-audit-indexes.mjs';
test('ABI-06 migration additive, idempotent, rollbackable and preserves existing audit rows',()=>{
 const db=openDatabase(':memory:');
 try {
  const rows=db.prepare('SELECT * FROM audit').all();
  const names=()=>db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='audit'").all().map(x=>x.name).sort();
  assert.deepEqual(names(),['audit_action_created_at_id','audit_actor_created_at_id','audit_created_at_id']);
  migrateAuditIndexes(db); assert.deepEqual(db.prepare('SELECT * FROM audit').all(),rows);
  rollbackAuditIndexes(db);assert.equal(names().length,0);assert.equal(db.prepare('SELECT 1 FROM migrations WHERE version=4').get(),undefined);
  assert.deepEqual(db.prepare('SELECT * FROM audit').all(),rows);
  migrateAuditIndexes(db);assert.equal(names().length,3);assert.deepEqual(db.prepare('SELECT * FROM audit').all(),rows);
 }finally{db.close();}
});
