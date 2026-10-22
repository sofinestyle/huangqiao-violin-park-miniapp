import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {overlay,root,prepareOverlay} from '../scripts/prepare-staging-teaching-api.mjs';

test('Historical Staging overlay remains pinned and refuses later Production source changes before packaging',t=>{
 const directory=join(root,'build','teaching-overlay-test-'+randomUUID());
 t.after(()=>{rmSync(directory,{recursive:true,force:true});rmSync(directory+'.zip',{force:true});});
 assert.notEqual(createHash('sha256').update(readFileSync(join(root,'server/pg/foundation.mjs'))).digest('hex'),overlay.files['server/pg/foundation.mjs']);
 assert.throws(()=>prepareOverlay(directory),/OVERLAY_SOURCE_CHANGED/);
 assert.equal(existsSync(directory),false);assert.equal(existsSync(directory+'.zip'),false);
 const docker=readFileSync(join(root,'deployment/staging-teaching-type/Dockerfile'),'utf8');
 assert.ok(docker.includes('FROM '+overlay.baseImage));
 assert.equal(docker.split('\n').filter(x=>x.startsWith('COPY ')).length,2);
 assert.ok(docker.includes('STAGING_BASE_SOURCE_MISMATCH'));
 assert.equal(/^\s*(ENV|CMD|ENTRYPOINT|USER|WORKDIR)\s/m.test(docker),false);
 assert.deepEqual(Object.keys(overlay.files).sort(),['server/pg/foundation.mjs','shared/teaching-types.mjs']);
 assert.throws(()=>prepareOverlay('/tmp/disallowed-overlay'),/NEW_BUILD_DIRECTORY_REQUIRED/);
 const occupied=directory+'-archive-only';
 t.after(()=>rmSync(occupied+'.zip',{force:true}));
 writeFileSync(occupied+'.zip','existing archive must remain unchanged');
 assert.throws(()=>prepareOverlay(occupied),/NEW_BUILD_DIRECTORY_REQUIRED/);
 assert.equal(readFileSync(occupied+'.zip','utf8'),'existing archive must remain unchanged');
});
