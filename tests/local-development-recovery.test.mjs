import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {openDatabase} from './pg-test-db.mjs';
import {assertLocalTarget,settings} from '../scripts/local-development/runtime.mjs';
import {inspectLegacy,importLegacy,excludedTables} from '../scripts/local-development/import.mjs';
import {configuration} from '../server/config.mjs';
const env={APP_ENV:'development',STORAGE_PROVIDER:'local',DATABASE_URL:`postgresql://hq_dev:synthetic@127.0.0.1:${settings.port}/hq_development`,PGSCHEMA:'app'};
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'hq-legacy-recovery-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 mkdirSync(join(dir,'.local/uploads'),{recursive:true});mkdirSync(join(dir,'images'));
 writeFileSync(join(dir,'images','legacy.png'),'synthetic static image');
 const video=Buffer.from('synthetic legacy video');writeFileSync(join(dir,'.local/uploads','video.mp4'),video);
 const sqlite=new DatabaseSync(join(dir,'.local/huangqiao.sqlite'));
 sqlite.exec('CREATE TABLE content(id TEXT,kind TEXT,name TEXT,data TEXT,state TEXT,sort INT,version INT,created_at TEXT,updated_at TEXT); CREATE TABLE media(id TEXT,filename TEXT,mime TEXT,size INT,sha256 TEXT,stored_name TEXT,rights TEXT,duration REAL,created_at TEXT); CREATE TABLE product_skus(id TEXT,product_id TEXT,sku_code TEXT,option_values TEXT,combination_key TEXT,reference_price REAL,images TEXT,enabled INT,sort_order INT,disable_reason TEXT,created_at TEXT,updated_at TEXT); CREATE TABLE accounts(password_hash TEXT); INSERT INTO accounts VALUES (\'never-import-this\');');
 const now='2026-10-09T00:00:00.000Z';
 const put=(id,kind,data)=>sqlite.prepare('INSERT INTO content VALUES (?,?,?,?,?,?,?,?,?)').run(id,kind,id,JSON.stringify(data),'published',0,1,now,now);
 put('site','site',{images:['/assets/legacy.png']});put('lesson','lesson',{mediaId:'video',isTest:false});put('product','product',{variantModelVersion:2});put('unknown','unsupported',{private:'exclude'});
 sqlite.prepare('INSERT INTO media VALUES (?,?,?,?,?,?,?,?,?)').run('video','video.mp4','video/mp4',video.length,sha(video),'video.mp4','synthetic rights',1,now);
 sqlite.prepare('INSERT INTO product_skus VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('sku','product','TEST_1','{"size":"full"}','size=full',1,'[]',1,0,'',now,now);sqlite.close();
 return {dir,video,sourceHash:sha(readFileSync(join(dir,'.local/huangqiao.sqlite')))};
}
test('Local target guard rejects remote/cloud/Production, alternate databases, schemas and URL overrides before connection',()=>{
 assert.equal(assertLocalTarget(env).port,settings.port);
 for(const override of [{APP_ENV:'staging'},{APP_ENV:'production'},{STORAGE_PROVIDER:'cloudbase'},{CLOUDBASE_BUCKET:'huangqiao-media'},{DATABASE_URL:'postgresql://u:p@172.17.0.13:5432/postgres-i56vqlwu'},{DATABASE_URL:env.DATABASE_URL.replace('127.0.0.1','cloud.example.invalid')},{DATABASE_URL:env.DATABASE_URL+'?host=172.17.0.13'},{DATABASE_URL:env.DATABASE_URL.replace('hq_development','staging')},{PGSCHEMA:'other'}])assert.throws(()=>assertLocalTarget({...env,...override}));
 assert.throws(()=>assertLocalTarget({...env,DATABASE_URL:'postgresql://u:p@172.17.0.13:5432/hq_test_unit',PGSCHEMA:'test_unit'},{test:true}));
 assert.throws(()=>configuration({...env,DATABASE_URL:'postgresql://u:p@172.17.0.13:5432/cloud'}));assert.throws(()=>configuration({...env,STORAGE_PROVIDER:'cloudbase'}));assert.throws(()=>configuration({...env,DATABASE_URL:env.DATABASE_URL+'?host=172.17.0.13'}));assert.throws(()=>configuration({...env,CLOUDBASE_BUCKET:'huangqiao-media'}));
});
test('Offline plan includes mediaId videos, compatible SKUs and allowed content only, marks Test and leaves SQLite unchanged',t=>{
 const f=fixture(t),p=inspectLegacy(f.dir);assert.equal(p.rows.content.length,3);assert.equal(p.rows.media.length,1);assert.equal(p.rows.product_skus.length,1);assert.ok(p.rows.content.every(r=>r.data.isTest));assert.deepEqual(p.staticImages,['/assets/legacy.png']);assert.equal(p.sourceDatabaseHash,f.sourceHash);assert.equal(sha(readFileSync(join(f.dir,'.local/huangqiao.sqlite'))),f.sourceHash);assert.equal(JSON.stringify(p).includes('never-import-this'),false);
});
test('Invalid media hash or symlink is rejected before database writes',t=>{
 const f=fixture(t),p=join(f.dir,'.local/uploads/video.mp4');writeFileSync(p,'corrupt');assert.throws(()=>inspectLegacy(f.dir),/HASH_MISMATCH/);rmSync(p);symlinkSync(join(f.dir,'images/legacy.png'),p);assert.throws(()=>inspectLegacy(f.dir),/SYMLINK/);
});
test('Restore is transactional, idempotent, resumes exact subsets and refuses to overwrite edited Development data',async t=>{
 const f=fixture(t),p=inspectLegacy(f.dir),db=await openDatabase(),uploads=join(f.dir,'restored');t.after(()=>db.close());
 const first=await importLegacy(db,p,uploads,{testTarget:true});assert.equal(first.action,'restored');assert.deepEqual(first.counts,{content:3,media:1,product_skus:1});assert.equal(sha(readFileSync(join(uploads,'video.mp4'))),sha(f.video));
 for(const table of excludedTables.filter(x=>x!=='migrations'))assert.equal((await db.one('SELECT count(*) n FROM '+table)).n,0);
 assert.equal((await db.one('SELECT count(*) n FROM migrations')).n,1);
 assert.equal((await importLegacy(db,p,uploads,{testTarget:true})).action,'already-restored');
 await db.execute("DELETE FROM media WHERE id='video'");assert.equal((await importLegacy(db,p,uploads,{testTarget:true})).action,'resumed');
 await db.execute("UPDATE content SET name='edited by developer' WHERE id='site'");await assert.rejects(importLegacy(db,p,uploads,{testTarget:true}),/NO_OVERWRITE/);assert.equal((await db.one("SELECT name FROM content WHERE id='site'")).name,'edited by developer');
});
test('Late SKU insertion failure rolls back all business rows; excluded target data blocks restoration',async t=>{
 const f=fixture(t),p=inspectLegacy(f.dir),db=await openDatabase();t.after(()=>db.close());
 p.rows.product_skus[0].sort_order=-1;await assert.rejects(importLegacy(db,p,join(f.dir,'copy'),{testTarget:true}));
 for(const table of ['content','media','product_skus'])assert.equal((await db.one('SELECT count(*) n FROM '+table)).n,0);
 await db.execute("INSERT INTO visitors(id,created_at) VALUES('existing',CURRENT_TIMESTAMP)");p.rows.product_skus[0].sort_order=0;await assert.rejects(importLegacy(db,p,join(f.dir,'copy'),{testTarget:true}),/EXCLUDED_TARGET_NOT_EMPTY/);assert.equal((await db.one('SELECT count(*) n FROM content')).n,0);
});
