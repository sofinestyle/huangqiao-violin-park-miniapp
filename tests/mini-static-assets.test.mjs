import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {auditMiniStaticAssets} from '../scripts/audit-mini-static-assets.mjs';

test('全小程序固定资源均存在，固定图片不能通过API拼接，外部图片无未解释引用',()=>{
 const audit=auditMiniStaticAssets();
 assert.deepEqual(audit.missingFixed,[]);
 assert.deepEqual(audit.serverDependentFixed,[]);
 assert.deepEqual(audit.unresolved,[]);
 assert.ok(audit.references.some(r=>r.kind==='B'),'业务图片仍由后台绑定提供');
});
test('workshop包内副本与受保护原件字节一致，两个环境使用同一路径且不访问API',()=>{
 const original=readFileSync(new URL('../images/workshop.jpg',import.meta.url));
 const packaged=readFileSync(new URL('../miniprogram/miniprogram/assets/images/workshop.jpg',import.meta.url));
 const hash=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(hash(original),hash(packaged));
 const code=ts.transpileModule(readFileSync(new URL('../miniprogram/miniprogram/pages/study/index.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 for(const environment of ['development','staging']){
  let page;
  vm.runInNewContext(code,{exports:{},Page:p=>{page=p;},require:()=>({api:()=>assert.fail('初始化固定背景不得请求API'),mediaUrl:()=>assert.fail('固定背景不得拼接环境URL')}),environment});
  assert.equal(page.data.heroImage,'/assets/images/workshop.jpg');
 }
});
