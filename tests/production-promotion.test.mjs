import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from './pg-test-db.mjs';
import {createPromotionPlan,promotionSql,contentFingerprintSql} from '../scripts/lib/production-content-promotion.mjs';
import {prepareProductionOverlay,files} from '../scripts/prepare-production-api.mjs';
import {readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
async function fixture(){
 const db=await openDatabase();await db.query("INSERT INTO content VALUES('site','site','isolated source','{\"isTest\":true,\"images\":[\"/api/media/unchanged\"],\"intro\":\"preserved\"}','published',0,3,now(),now())");
 const row=await db.one(`SELECT id,kind,name,state,version,data->'isTest' AS "isTest",updated_at AS "updatedAt",${contentFingerprintSql('c')} AS "rowFingerprint" FROM content c`);
 const {database}=await db.one('SELECT current_database() AS database');
 const plan=createPromotionPlan([row],{database,schema:db.schema});
 const approval={manifestSha256:plan.sha256,approvedBy:'project-owner',approvedAt:'2026-10-22T00:00:00Z'};
 return {db,plan,approval};
}
test('Promotion has no executable SQL without approval of the exact unchanged manifest',async t=>{
 const {db,plan,approval}=await fixture();t.after(()=>db.close());
 assert.throws(()=>promotionSql(plan),/EXPLICIT_DATA_APPROVAL_REQUIRED/);
 assert.throws(()=>promotionSql(plan,{...approval,manifestSha256:'0'.repeat(64)}));
 const altered=structuredClone(plan);altered.content[0].name='altered';assert.throws(()=>promotionSql(altered,approval),/PLAN_CHANGED/);
 assert.equal((await db.one('SELECT count(*) AS n FROM audit')).n,0);
});
test('Approved marking changes only the flag and concurrency metadata; emits one bounded audit',async t=>{
 const {db,plan,approval}=await fixture();t.after(()=>db.close());const before=await db.one('SELECT * FROM content');
 await db.query(promotionSql(plan,approval));const after=await db.one('SELECT * FROM content');
 assert.equal(after.data.isTest,false);assert.equal(after.version,before.version+1);
 const keep=x=>{const y=structuredClone(x);delete y.data.isTest;delete y.version;delete y.updated_at;return y;};assert.deepEqual(keep(after),keep(before));
 const audit=await db.one('SELECT * FROM audit');assert.equal(audit.action,'content.production-promote');assert.equal(audit.detail.manifestSha256,plan.sha256);assert.deepEqual(audit.detail.contentIds,['site']);
 await assert.rejects(db.query(promotionSql(plan,approval)));assert.equal((await db.one('SELECT count(*) AS n FROM audit')).n,1);
});
test('Concurrent edits or extra content abort the entire batch without overwriting data',async t=>{
 for(const change of ['edit','insert']){
  const {db,plan,approval}=await fixture();t.after(()=>db.close());
  if(change==='edit')await db.query("UPDATE content SET name='newer operator edit' WHERE id='site'");
  else await db.query("INSERT INTO content SELECT 'extra',kind,name,data,state,sort,version,created_at,updated_at FROM content WHERE id='site'");
  const before=await db.many('SELECT * FROM content ORDER BY id');await assert.rejects(db.query(promotionSql(plan,approval)));
  assert.deepEqual(await db.many('SELECT * FROM content ORDER BY id'),before);assert.equal((await db.one('SELECT count(*) AS n FROM audit')).n,0);
 }
});

test('Cloud artifact contains only the four reviewed files and pinned base; never copies project secrets or business data',t=>{
 const dest=resolve('build/production-overlay-test-'+randomUUID());
 t.after(()=>{rmSync(dest,{recursive:true,force:true});rmSync(dest+'.zip',{force:true});});
 const result=prepareProductionOverlay(dest),entries=execFileSync('unzip',['-Z1',result.archive],{encoding:'utf8'}).trim().split('\n').sort();
 assert.deepEqual(entries,[...files,'Dockerfile','OVERLAY_MANIFEST.json'].sort());
 const manifest=JSON.parse(readFileSync(dest+'/OVERLAY_MANIFEST.json','utf8'));
 assert.equal(manifest.databaseMigration,false);assert.equal(manifest.businessDataBundled,false);assert.equal(manifest.cloudDeploymentExecuted,false);
 assert.match(readFileSync(dest+'/Dockerfile','utf8'),/@sha256:dae4986644a1026746af37702e99be1acd6446677da4559dcc2a42344253631a/);
 assert.throws(()=>prepareProductionOverlay(dest),/NEW_BUILD_DIRECTORY_REQUIRED/);
 assert.throws(()=>prepareProductionOverlay('/tmp/unsafe-production-overlay'),/NEW_BUILD_DIRECTORY_REQUIRED/);
});
