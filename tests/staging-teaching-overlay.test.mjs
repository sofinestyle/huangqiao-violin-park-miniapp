import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {overlay,root,prepareOverlay} from '../scripts/prepare-staging-teaching-api.mjs';

test('Staging overlay packages only the two approved runtime files on a digest-pinned image',t=>{
 const directory=join(root,'build','teaching-overlay-test-'+randomUUID());
 t.after(()=>{rmSync(directory,{recursive:true,force:true});rmSync(directory+'.zip',{force:true});});
 const built=prepareOverlay(directory);
 assert.deepEqual(execFileSync('unzip',['-Z1',built.archive],{encoding:'utf8'}).trim().split('\n').sort(),['Dockerfile','OVERLAY_MANIFEST.json','server/pg/foundation.mjs','shared/teaching-types.mjs'].sort());
 const docker=readFileSync(join(directory,'Dockerfile'),'utf8');
 assert.ok(docker.includes('FROM '+overlay.baseImage));
 assert.equal(docker.split('\n').filter(x=>x.startsWith('COPY ')).length,2);
 assert.ok(docker.includes('STAGING_BASE_SOURCE_MISMATCH'));
 assert.equal(/^\s*(ENV|CMD|ENTRYPOINT|USER|WORKDIR)\s/m.test(docker),false);
 assert.deepEqual(built.manifest.configChanges,[]);
 assert.equal(built.manifest.databaseMigration,false);
 assert.equal(built.manifest.automaticClassification,false);
 assert.throws(()=>prepareOverlay(directory),/NEW_BUILD_DIRECTORY_REQUIRED/);
 assert.throws(()=>prepareOverlay('/tmp/disallowed-overlay'),/NEW_BUILD_DIRECTORY_REQUIRED/);
 const occupied=directory+'-archive-only';
 t.after(()=>rmSync(occupied+'.zip',{force:true}));
 writeFileSync(occupied+'.zip','existing archive must remain unchanged');
 assert.throws(()=>prepareOverlay(occupied),/NEW_BUILD_DIRECTORY_REQUIRED/);
 assert.equal(readFileSync(occupied+'.zip','utf8'),'existing archive must remain unchanged');
});
