import test from 'node:test';
import assert from 'node:assert/strict';
import {build,preview} from 'vite';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

test('Admin root deployment bundles original logo, serves PNG HTTP 200, and excludes local business asset candidates',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'hq-admin-assets-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 await build({root:resolve('admin'),base:'/',logLevel:'silent',build:{outDir:dir,emptyOutDir:true}});
 const assets=await readdir(join(dir,'assets')),logo=assets.find(n=>/^yorray-logo-.*\.png$/.test(n));assert.ok(logo);assert.deepEqual(await readFile(join(dir,'assets',logo)),await readFile('images/yorray-logo.png'));
 const app=await readFile('admin/src/App.jsx','utf8'),content=await readFile('admin/src/Content.jsx','utf8');assert.equal((app.match(/src=\{yorrayLogo\}/g)||[]).length,2);assert.doesNotMatch(content,/\/assets\//);assert.match(content,/\/api\/media\//);
 const bundle=(await Promise.all(assets.filter(n=>n.endsWith('.js')).map(n=>readFile(join(dir,'assets',n),'utf8')))).join('');assert.ok(bundle.includes('/assets/'+logo));assert.doesNotMatch(bundle,/\/assets\/(?:city|c1|lake|industry|green|violin|yorray-logo)\.(?:png|jpg)/);
 const server=await preview({root:resolve('admin'),base:'/',logLevel:'silent',build:{outDir:dir},preview:{host:'127.0.0.1',port:0,strictPort:false}});t.after(()=>new Promise(r=>server.httpServer.close(r)));
 const url='http://127.0.0.1:'+server.httpServer.address().port,r=await fetch(url+'/assets/'+logo);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/png/);assert.deepEqual(Buffer.from(await r.arrayBuffer()),await readFile('images/yorray-logo.png'));
});
