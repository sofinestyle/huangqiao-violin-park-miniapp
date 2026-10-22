import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,mkdirSync} from 'node:fs';import {resolve,join} from 'node:path';import {execFileSync} from 'node:child_process';
import {prepareProductionAdmin} from '../scripts/prepare-production-admin.mjs';
test('Root static Admin archive contains the actual referenced scripts and styles, keeping same-origin API and redirects',()=>{
 mkdirSync('build',{recursive:true});const parent=mkdtempSync(resolve('build/admin-static-test-'));
 try{const result=prepareProductionAdmin(join(parent,'static')),html=execFileSync('unzip',['-p',result.archive,'index.html'],{encoding:'utf8'});
  assert.equal(result.manifest.hostingBase,'/');assert.equal(result.manifest.sameOrigin,true);assert.doesNotMatch(html,/\/admin\/assets\//);
  const refs=[...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(x=>x[1].slice(1));assert.equal(refs.length,2);
  for(const ref of refs)assert.ok(execFileSync('unzip',['-p',result.archive,ref]).length>0);
  const js=execFileSync('unzip',['-p',result.archive,refs.find(p=>p.endsWith('.js'))],{encoding:'utf8'});assert.match(js,/\/api\/admin/);assert.match(js,/https:\/\/admin\.yorray\.com/);assert.doesNotMatch(js,/\/admin\/assets\//);
  assert.equal(readFileSync('admin/vite.config.js','utf8').includes("base:'/admin/'"),true);
  assert.throws(()=>prepareProductionAdmin(join(parent,'static')),/NEW_BUILD_DIRECTORY_REQUIRED/);
 }finally{rmSync(parent,{recursive:true,force:true});}
});
