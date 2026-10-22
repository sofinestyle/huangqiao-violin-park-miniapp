import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {resolve,dirname} from 'node:path';
import {auditMiniStaticAssets} from '../scripts/audit-mini-static-assets.mjs';

test('品牌普通分包保持原路由，主包无跨分包固定资源依赖，历史大图排除上传',()=>{
 const app=JSON.parse(readFileSync('miniprogram/miniprogram/app.json'));
 assert.ok(app.subPackages.some(p=>p.root==='pages/brand'&&p.pages.includes('index')&&!p.independent));
 const audit=auditMiniStaticAssets();
 for(const ref of audit.references.filter(r=>r.kind==='A'))for(const target of ref.targets){
  const owner=app.subPackages.find(p=>target.startsWith('/'+p.root+'/'));
  assert.ok(!owner||ref.file.startsWith(owner.root+'/'),'主包或其他分包不能直接依赖品牌分包图片');
 }
 const project=JSON.parse(readFileSync('miniprogram/project.config.json'));
 const ignored=project.packOptions.ignore.filter(p=>p.type==='file').map(p=>'/'+p.value);
 for(const old of audit.unreferencedAssets)assert.ok(ignored.includes(old.path),'未引用大图不进入实际上传包');
});

test('隔离构建输出兼容JavaScript并保留环境选择与Production阻止机制',()=>{
 for(const environment of ['development','staging']){
  const r=spawnSync(process.execPath,['scripts/build-mini.mjs'],{env:{...process.env,APP_ENV:environment,MINI_APPID:''},encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const root='build/mini-'+environment;
  const target=readFileSync(root+'/miniprogram/build-target.js','utf8');
  assert.ok(target.includes(environment));
  const api=readFileSync(root+'/miniprogram/lib/api.js','utf8');
  assert.doesNotMatch(api,/\?\.|\?\?/,'可选链和空值合并必须降级，避免微信服务端语法拒绝');
  function loadConfig(version){
   const wx={getAccountInfoSync:()=>({miniProgram:{envVersion:version}}),getLaunchOptionsSync:()=>({query:{}})};
   function load(file){const exports={};vm.runInNewContext('(function(require,exports,wx){'+readFileSync(file,'utf8')+'\n})')(name=>load(resolve(dirname(file),name+'.js')),exports,wx);return exports;}
   return load(resolve(root,'miniprogram/config.js'));
  }
  assert.equal(loadConfig('develop').getEnvironment().name,environment);
  assert.equal(loadConfig('trial').getEnvironment().name,'staging');
  assert.throws(()=>loadConfig('release').getEnvironment(),/Production尚未批准/);
  const project=JSON.parse(readFileSync(root+'/project.config.json'));
  assert.equal(project.appid,'wx5dee6ef3087366c0');
  assert.equal(project.appid,JSON.parse(readFileSync('miniprogram/project.config.json')).appid);
  assert.ok(!project.setting.useCompilerPlugins.includes('typescript'),'生成JS后不重复执行TS插件');
 }
});

test('错误AppID在覆盖既有构建产物前被拒绝',()=>{
 for(const environment of ['development','staging']){
  const root='build/mini-'+environment;
  const before=readFileSync(root+'/project.config.json','utf8');
  const r=spawnSync(process.execPath,['scripts/build-mini.mjs'],{env:{...process.env,APP_ENV:environment,MINI_APPID:'wx5bf0160bd4262e24'},encoding:'utf8'});
  assert.notEqual(r.status,0);assert.match(r.stderr,/MINI_APPID与项目AppID不一致/);
  assert.equal(readFileSync(root+'/project.config.json','utf8'),before);
 }
});


test('Production local preparation emits a disabled, minified, domain-checked candidate only under explicit flag',()=>{
 const r=spawnSync(process.execPath,['scripts/build-mini.mjs','--prepare-production'],{env:{...process.env,APP_ENV:'production',MINI_APPID:''},encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const root='build/mini-production',manifest=JSON.parse(readFileSync(root+'/PREPARATION_ONLY.json')),project=JSON.parse(readFileSync(root+'/project.config.json'));
 assert.equal(manifest.runtimeEnabled,false);assert.equal(manifest.apiBase,'https://admin.yorray.com');assert.equal(manifest.uploadApproved,false);assert.equal(manifest.releaseApproved,false);
 assert.equal(project.setting.minified,true);assert.equal(project.setting.urlCheck,true);assert.equal(project.condition.miniprogram.list.length,0);assert.equal(project.appid,'wx5dee6ef3087366c0');
 assert.match(readFileSync(root+'/miniprogram/build-target.js','utf8'),/production/);
 for(const env of [{MINI_API_BASE:'http://127.0.0.1:8787'},{MINI_APPID:'wx5bf0160bd4262e24'}]){
  const failed=spawnSync(process.execPath,['scripts/build-mini.mjs','--prepare-production'],{env:{...process.env,APP_ENV:'production',...env},encoding:'utf8'});assert.notEqual(failed.status,0);assert.equal(readFileSync(root+'/project.config.json','utf8'),JSON.stringify(project,null,2)+'\n');
 }
});
