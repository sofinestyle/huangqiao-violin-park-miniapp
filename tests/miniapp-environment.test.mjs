import test from 'node:test';import assert from 'node:assert/strict';
import ts from 'typescript';import vm from 'node:vm';
import {readFileSync,readdirSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {resolve,dirname,join} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';
function host({version='develop',query={},target,storage=new Map(),status=200}={}){
 const cache=new Map(),requests=[];let component;
 const wx={getAccountInfoSync:()=>({miniProgram:{envVersion:version}}),getLaunchOptionsSync:()=>({query}),getStorageSync:k=>storage.get(k)||'',setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),login:o=>o.success({code:'synthetic-wechat-code'}),request:o=>{requests.push(o);o.success({statusCode:status,data:{token:'synthetic-'+requests.length,error:'synthetic'}});}};
 function load(file){if(cache.has(file))return cache.get(file).exports;
  if(file.endsWith('/build-target.ts')&&target)return {default:{environment:target}};
  const module={exports:{}};cache.set(file,module);
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext('(function(require,module,exports,wx,Component){'+code+'\n})',{console,Promise,Object,Error})(name=>load(resolve(dirname(file),name+'.ts')),module,module.exports,wx,c=>{component={...c,data:{...c.data},setData(v){Object.assign(this.data,v);}};});return module.exports;}
 return {wx,requests,storage,load:name=>load(resolve('miniprogram/miniprogram',name+'.ts')),component:()=>component};
}
test('Native default resolves real existing loopback; query selects fixed Staging, never an arbitrary URL',()=>{
 for(const [query,name] of [[{},'development'],[{miniEnvironment:'development'},'development'],[{miniEnvironment:'staging'},'staging']]){const h=host({query}),c=h.load('config'),e=c.getEnvironment();assert.equal(e.name,name);assert.equal(e.showDebug,true);assert.equal(e.apiBase,name==='development'?'http://127.0.0.1:8787':'https://huangqiao-staging-d2d1dj1bb4ad90-1300244228.ap-shanghai.app.tcloudbase.com');}
 for(const value of ['production','https://production.example','localhost','invalid'])assert.throws(()=>host({query:{miniEnvironment:value}}).load('config').getEnvironment());
});
test('Trial is always Staging and hides debug; release/unknown fail closed before any request',async()=>{
 const e=host({version:'trial',query:{miniEnvironment:'development'}}).load('config').getEnvironment();assert.equal(e.name,'staging');assert.equal(e.showDebug,false);assert.equal(e.identityMode,'wechat');
 for(const version of ['release','unknown',undefined]){const h=host({version:version===undefined?null:version});await assert.rejects(h.load('lib/api').api('/api/health'));assert.equal(h.requests.length,0);}
});
test('Target package chooses Staging in develop; selection remains fixed during navigation/query mutation',()=>{
 const query={},h=host({target:'staging',query}),c=h.load('config');assert.equal(c.getEnvironment().name,'staging');query.miniEnvironment='development';assert.equal(c.getEnvironment().name,'staging');assert.ok(Object.isFrozen(c.getEnvironment()));
});
test('Requests and all decorated image/video/SKU URLs follow same target and reject absolute paths',async()=>{
 for(const name of ['development','staging']){const h=host({query:{miniEnvironment:name}}),a=h.load('lib/api'),base=h.load('config').getEnvironment().apiBase;await a.api('/api/public/content?kind=spot');assert.equal(h.requests[0].url,base+'/api/public/content?kind=spot');const row=a.decorate({id:'s',kind:'product',name:'synthetic',images:['/api/media/image'],mediaId:'video',skus:[{effectiveImages:['/api/media/sku']}]});assert.equal(row.cover,base+'/api/media/image');assert.equal(row.images[0],row.cover);assert.equal(row.videoUrl,base+'/api/media/video');assert.equal(row.skus[0].effectiveImages[0],base+'/api/media/sku');await assert.rejects(a.api('https://example.invalid/api/health'));assert.equal(h.requests.length,1);}
});
test('Tokens do not cross targets or reuse legacy token; auth and idempotency protocol remains intact',async()=>{
 const storage=new Map([['hq-visitor-token','legacy'],['hq-visitor-token:development','dev-token']]);const h=host({query:{miniEnvironment:'staging'},storage}),a=h.load('lib/api');await a.api('/api/visitor/bookings',{auth:true,key:'same-key'});assert.equal(h.requests[0].header.Authorization,undefined);assert.equal(h.requests[0].header['Idempotency-Key'],'same-key');await a.ensureIdentity();assert.equal(h.requests[1].url.endsWith('/api/auth/wechat'),true);assert.equal(storage.get('hq-visitor-token:development'),'dev-token');assert.ok(storage.get('hq-visitor-token:staging'));assert.equal(storage.get('hq-visitor-token'),'legacy');await a.api('/api/visitor/bookings',{auth:true});assert.ok(h.requests[2].header.Authorization);const dev=host({storage,status:401});await assert.rejects(dev.load('lib/api').api('/api/visitor/bookings',{auth:true}));assert.equal(storage.has('hq-visitor-token:development'),false);assert.ok(storage.has('hq-visitor-token:staging'));
});
test('Development identity remains on local auth; trial cannot call development auth',async()=>{
 const dev=host();await dev.load('lib/api').ensureIdentity();assert.ok(dev.requests[0].url.endsWith('/api/auth/development'));const trial=host({version:'trial'});await trial.load('lib/api').ensureIdentity();assert.ok(trial.requests[0].url.endsWith('/api/auth/wechat'));
});
test('Status component visible only in develop, hides even blocked release',()=>{
 for(const [version,visible,label] of [['develop',true,'DEV · 本地'],['trial',false,'STAGING · 云端'],['release',false,'API 已阻止']]){const h=host({version});h.load('components/environment-status/index');const c=h.component();c.lifetimes.attached.call(c);assert.equal(c.data.visible,visible);assert.equal(c.data.label,label);}
});
test('Production builds and out-of-SSOT overrides rejected before any package is emitted',()=>{
 for(const env of [{APP_ENV:'production',MINI_API_BASE:'https://example.invalid',MINI_APPID:'wx5bf0160bd4262e24'},{APP_ENV:'production',MINI_API_BASE:'http://localhost:8787'},{APP_ENV:'development',MINI_API_BASE:'https://production.example.invalid'},{APP_ENV:'staging',MINI_API_BASE:'http://127.0.0.1:8787'},{APP_ENV:'invalid'}]){const r=spawnSync(process.execPath,['scripts/build-mini.mjs'],{env:{...process.env,...env},encoding:'utf8'});assert.notEqual(r.status,0);}
});
test('All page origins absent, wx.request only centralized, one environment SSOT and five tabs retained',()=>{
 function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
 for(const file of files('miniprogram/miniprogram/pages').filter(f=>f.endsWith('.ts')))assert.doesNotMatch(readFileSync(file,'utf8'),/localhost|127\.0\.0\.1|tcloudbase|wx\.request/);
 const requests=files('miniprogram/miniprogram').filter(f=>f.endsWith('.ts')&&/wx\.request\(/.test(readFileSync(f,'utf8')));assert.deepEqual(requests,['miniprogram/miniprogram/lib/api.ts']);
 const app=JSON.parse(readFileSync('miniprogram/miniprogram/app.json','utf8'));assert.deepEqual(app.tabBar.list.map(x=>x.text),['首页','乐器','文创','研学','我的']);
 const h=host(),settings=h.load('environment-settings').default;assert.equal(settings.production.enabled,false);assert.equal(settings.production.apiBase,null);
});
test('Compile-mode preparation preserves domain/security and existing private conditions and is idempotent',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hq-mini-prepare-'));try{mkdirSync(join(dir,'miniprogram'));const original={setting:{urlCheck:true},condition:{miniprogram:{list:[{name:'用户原有模式',query:'x=1'}]}},libVersion:'3.17.3'};writeFileSync(join(dir,'miniprogram/project.private.config.json'),JSON.stringify(original));writeFileSync(join(dir,'miniprogram/project.config.json'),readFileSync('miniprogram/project.config.json'));
 const run=()=>spawnSync(process.execPath,[resolve('scripts/prepare-mini-environments.mjs')],{cwd:dir,encoding:'utf8'});assert.equal(run().status,0);assert.equal(run().status,0);const result=JSON.parse(readFileSync(join(dir,'miniprogram/project.private.config.json')));assert.deepEqual(result.setting,original.setting);assert.equal(result.libVersion,original.libVersion);assert.equal(result.condition.miniprogram.list.length,3);assert.equal(result.condition.miniprogram.list[0].query,'x=1');}finally{rmSync(dir,{recursive:true,force:true});}
});
