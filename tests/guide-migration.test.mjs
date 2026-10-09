import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,copyFile,rm,unlink,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase} from './pg-test-db.mjs';
import {digest,canonical,validateManifest,inspectSource,expectedRows,checkTarget,pgTarget,runMigration} from '../scripts/guide-migration/core.mjs';
import {parseArgs,targetConfig} from '../scripts/migrate-guide.mjs';
const manifest=JSON.parse(await readFile(new URL('../docs/deployment/phase-2c/guide-manifest.json',import.meta.url),'utf8'));
async function source(t){
 const root=await mkdtemp(join(tmpdir(),'hq-guide-source-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'.local'));await mkdir(join(root,'images'));
 const db=new DatabaseSync(join(root,manifest.source));
 db.exec('CREATE TABLE content(id TEXT,kind TEXT,name TEXT,data TEXT,state TEXT,sort INTEGER,version INTEGER,created_at TEXT,updated_at TEXT); CREATE TABLE accounts(marker TEXT); INSERT INTO accounts VALUES (\'must-remain\')');
 for(const {source:r} of manifest.records)db.prepare('INSERT INTO content VALUES(?,?,?,?,?,?,?,?,?)').run(r.id,r.kind,r.name,JSON.stringify(r.data),r.state,r.sort,r.version,r.created_at,r.updated_at);db.close();
 for(const f of manifest.media)await copyFile(resolve(f.sourcePath),join(root,f.sourcePath));return root;
}
function storageFake(){
 const objects=new Map();let puts=0;
 return {objects,get puts(){return puts;},failAt:0,
  async put(key,stream,{mime}){puts++;if(this.failAt===puts)throw Error('STORAGE_FAILED');assert.ok(!objects.has(key));const chunks=[];for await(const b of stream)chunks.push(b);objects.set(key,{body:Buffer.concat(chunks),mime});},
  async videoMetadata(key){const o=objects.get(key);if(!o)throw Object.assign(Error('missing'),{storageStatus:404});return {mime:o.mime,size:o.body.length};},
  async read(key){return Readable.from([objects.get(key).body]);}
 };
}
async function setup(t){const root=await source(t),db=await openDatabase(),storage=storageFake(),target=pgTarget(db,manifest),events=[];t.after(()=>db.close());return {root,db,storage,target,manifest,events,record:async x=>events.push(x)};}
const excluded=['accounts','sessions','audit','idempotency','migrations','visitors','bookings','changes','consultations','slots','product_skus'];
async function excludedState(db){const out={};for(const table of excluded)out[table]=await db.many('SELECT * FROM '+table);return canonical(out);}

test('guide manifest freezes 4 source records, 19 images, order and new UUIDs',()=>{
 validateManifest(manifest);const rows=expectedRows(manifest);assert.equal(rows.content.length,4);assert.equal(rows.media.length,19);assert.equal(manifest.media.reduce((n,f)=>n+f.size,0),2479011);
 rows.content.forEach((r,i)=>{const s=manifest.records[i].source;assert.notEqual(r.id,s.id);assert.equal(r.version,1);assert.equal(r.data.isTest,true);assert.equal(canonical({...r.data,images:s.data.images}),canonical(s.data));});
 assert.deepEqual(rows.content.flatMap(r=>r.data.images),rows.media.map(m=>'/api/media/'+m.id));
 const invalid=structuredClone(manifest);invalid.records[0].source.id='spot-5';assert.throws(()=>validateManifest(invalid),/ALLOWLIST/);
});
test('guide CLI defaults to dry-run and rejects widened category, ambiguous modes and execute snapshots',()=>{
 assert.equal(parseArgs(['--category=guide']).execute,false);for(const args of [[],['--category=instrument'],['--category=guide','--execute','--dry-run'],['--category=guide','--execute','--target-snapshot=x'],['--category=guide','--other']])assert.throws(()=>parseArgs(args));
 const env={APP_ENV:'staging',PGSCHEMA:'app',GUIDE_DATABASE_URL:'postgresql://test:test@isolated.invalid/postgres-i56vqlwu',GUIDE_TARGET_HOST:'isolated.invalid',CLOUDBASE_ENV_ID:manifest.target.cloudbaseEnv,CLOUDBASE_BUCKET:manifest.target.bucket};
 assert.equal(targetConfig(env,manifest).schema,'app');for(const patch of [{APP_ENV:'production'},{PGSCHEMA:'public'},{GUIDE_TARGET_HOST:'other.invalid'},{CLOUDBASE_BUCKET:'cos-bucket'},{GUIDE_DATABASE_URL:'postgresql://test:test@isolated.invalid/other'}])assert.throws(()=>targetConfig({...env,...patch},manifest));
});
test('guide dry-run reads only approved source, verifies all hashes and never uploads/writes',async t=>{
 const x=await setup(t),before=await excludedState(x.db),sourceHash=digest(await readFile(join(x.root,manifest.source)));
 const r=await runMigration(x);assert.equal(r.status,'DRY_RUN_READY');assert.equal(r.targetCheck,'empty');assert.equal(x.storage.puts,0);assert.deepEqual(r.before,{content:0,media:0});assert.equal(await excludedState(x.db),before);assert.equal(digest(await readFile(join(x.root,manifest.source))),sourceHash);
 const offline=await runMigration({root:x.root,manifest});assert.equal(offline.status,'SOURCE_READY_TARGET_UNCHECKED');
});
test('guide isolated PG execute is atomic, preserves fields and excludes all other tables; repeat is idempotent',async t=>{
 const x=await setup(t),before=await excludedState(x.db),sourceHash=digest(await readFile(join(x.root,manifest.source)));
 const r=await runMigration({...x,execute:true});assert.equal(r.uploaded,19);assert.deepEqual(r.inserted,{content:4,media:19});assert.deepEqual(r.after,{content:4,media:19});
 assert.equal(checkTarget(manifest,await x.target.inspect()),'already-migrated');assert.equal(await excludedState(x.db),before);assert.equal(digest(await readFile(join(x.root,manifest.source))),sourceHash);
 const again=await runMigration({...x,execute:true});assert.equal(x.storage.puts,19);assert.equal(again.reusedObjects,19);assert.deepEqual(again.inserted,{content:0,media:0});assert.equal(await excludedState(x.db),before);
});
test('guide target human edit, unknown name/object key and partial batch stop before uploads',async t=>{
 const x=await setup(t);await runMigration({...x,execute:true});await x.db.execute('UPDATE content SET version=2 WHERE id=$1',[manifest.records[0].targetId]);
 await assert.rejects(runMigration({...x,execute:true}),/TARGET_CONFLICT/);assert.equal(x.storage.puts,19);
 const rows=expectedRows(manifest);assert.throws(()=>checkTarget(manifest,{content:[{...rows.content[0],id:'manual'}],media:[]}),/TARGET_CONFLICT/);
 assert.throws(()=>checkTarget(manifest,{content:[],media:[{...rows.media[0],id:'manual'}]}),/TARGET_CONFLICT/);assert.throws(()=>checkTarget(manifest,{content:[rows.content[0]],media:[]}),/TARGET_PARTIAL_BATCH/);
});
test('guide missing image and changed image/hash refuse migration before any cloud write',async t=>{
 const x=await setup(t),path=join(x.root,manifest.media[0].sourcePath);await writeFile(path,'changed');await assert.rejects(runMigration({...x,execute:true}),/SOURCE_MEDIA_CHANGED/);await unlink(path);await assert.rejects(runMigration({...x,execute:true}),/ENOENT/);assert.equal(x.storage.puts,0);assert.equal((await x.target.inspect()).counts.content,0);
});
test('guide source content drift and symlink are rejected',async t=>{
 const root=await source(t),path=join(root,manifest.source),db=new DatabaseSync(path);db.exec("UPDATE content SET name='changed' WHERE id='spot-1'");db.close();await assert.rejects(inspectSource(root,manifest),/SOURCE_GUIDE_CHANGED/);
 const root2=await source(t),image=join(root2,manifest.media[0].sourcePath);await unlink(image);await symlink(resolve(manifest.media[0].sourcePath),image);await assert.rejects(inspectSource(root2,manifest),/SOURCE_SYMLINK_REFUSED/);
});
test('guide failed upload leaves zero DB rows, journals orphan candidates and retry reuses verified objects',async t=>{
 const x=await setup(t);x.storage.failAt=4;await assert.rejects(runMigration({...x,execute:true}),/STORAGE_FAILED/);assert.deepEqual((await x.target.inspect()).counts,{content:0,media:0});assert.equal(x.storage.objects.size,3);assert.equal(x.events.at(-1).potentialOrphans.length,19);assert.equal(x.events.at(-1).reconcileBeforeCleanup,true);
 x.storage.failAt=0;const r=await runMigration({...x,execute:true});assert.equal(r.reusedObjects,3);assert.equal(r.uploaded,16);assert.deepEqual(r.inserted,{content:4,media:19});
});
test('guide PG content insert failure rolls back all media and retry never reuploads existing verified objects',async t=>{
 const x=await setup(t);await x.db.query("CREATE FUNCTION reject_guide() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated test failure'; END $$; CREATE TRIGGER reject_guide BEFORE INSERT ON content FOR EACH ROW EXECUTE FUNCTION reject_guide()");
 await assert.rejects(runMigration({...x,execute:true}));assert.deepEqual((await x.target.inspect()).counts,{content:0,media:0});assert.equal(x.storage.objects.size,19);
 await x.db.query('DROP TRIGGER reject_guide ON content');const r=await runMigration({...x,execute:true});assert.equal(r.reusedObjects,19);assert.equal(x.storage.puts,19);
});
test('guide remote metadata/hash mismatch and missing registered object never overwrite or silently succeed',async t=>{
 const x=await setup(t),f=manifest.media[0];x.storage.objects.set(f.objectKey,{body:Buffer.alloc(f.size),mime:f.mime});await assert.rejects(runMigration({...x,execute:true}),/REMOTE_HASH_CONFLICT/);assert.equal(x.storage.puts,0);
 x.storage.objects.get(f.objectKey).mime='video/mp4';await assert.rejects(runMigration({...x,execute:true}),/REMOTE_METADATA_CONFLICT/);x.storage.objects.clear();await runMigration({...x,execute:true});x.storage.objects.delete(f.objectKey);await assert.rejects(runMigration({...x,execute:true}),/REGISTERED_OBJECT_MISSING/);assert.equal(x.storage.puts,19);
});
