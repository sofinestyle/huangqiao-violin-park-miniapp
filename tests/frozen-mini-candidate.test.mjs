import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {resolve,join} from 'node:path';
import {freezeMiniCandidate,verifyFrozenCandidate} from '../scripts/freeze-mini-internal-candidate.mjs';
test('Freezing rejects preparation artifacts and disabled compiled runtimes; subsequent test output cannot replace the frozen candidate',()=>{
 mkdirSync('build',{recursive:true});const dir=mkdtempSync(resolve('build/frozen-mini-test-')),src=join(dir,'build-output');mkdirSync(join(src,'miniprogram'),{recursive:true});
 const json=(file,value)=>writeFileSync(join(src,file),JSON.stringify(value));
 const runtime=enabled=>writeFileSync(join(src,'miniprogram/environment-settings.js'),'exports.default='+JSON.stringify({production:{enabled,apiBase:'https://admin.yorray.com'}}));
 try{
  json('project.config.json',{appid:'wx5dee6ef3087366c0',setting:{urlCheck:true,minified:true}});json('PREPARATION_ONLY.json',{runtimeEnabled:false});
  assert.throws(()=>freezeMiniCandidate(src,join(dir,'invalid')),/INTERNAL_CANDIDATE_REQUIRED/);rmSync(join(src,'PREPARATION_ONLY.json'));
  json('INTERNAL_CANDIDATE.json',{environment:'production',runtimeEnabled:true,uploadApproved:true,uploadPurpose:'internal-experience-only',reviewApproved:false,releaseApproved:false,apiBase:'https://admin.yorray.com'});
  writeFileSync(join(src,'miniprogram/build-target.js'),'exports.default={environment:"production"}');runtime(false);assert.throws(()=>freezeMiniCandidate(src,join(dir,'disabled')),/RUNTIME_GUARD/);
  runtime(true);const frozen=freezeMiniCandidate(src,join(dir,'frozen'));const initial=verifyFrozenCandidate(frozen.directory);runtime(false);json('PREPARATION_ONLY.json',{runtimeEnabled:false});
  assert.equal(verifyFrozenCandidate(frozen.directory).sha256,initial.sha256);assert.throws(()=>freezeMiniCandidate(src,join(dir,'replaced')),/INTERNAL_CANDIDATE_REQUIRED/);
  writeFileSync(join(frozen.directory,'miniprogram/environment-settings.js'),'exports.default={production:{enabled:false}}');assert.throws(()=>verifyFrozenCandidate(frozen.directory),/RUNTIME_GUARD|FROZEN_CANDIDATE_CHANGED/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
