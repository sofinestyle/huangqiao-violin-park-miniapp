import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';
import ts from 'typescript';

const root=new URL('../miniprogram/miniprogram/',import.meta.url).pathname;
const config=JSON.parse(readFileSync(join(root,'app.json'),'utf8'));
const registered=new Set(config.pages);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}

test('页面注册与源文件一致，所有固定跳转和首页动态入口有目标',()=>{
 assert.equal(registered.size,config.pages.length,'不能重复注册页面');
 for(const page of registered)for(const ext of ['ts','json','wxml','wxss'])assert.ok(existsSync(join(root,page+'.'+ext)),page+'.'+ext);
 const diskPages=files(join(root,'pages')).filter(p=>p.endsWith('.wxml')).map(p=>relative(root,p).slice(0,-5));
 assert.deepEqual([...registered].sort(),diskPages.sort(),'不保留未注册的页面源码');
 const sources=files(root).filter(p=>/\.(ts|wxml)$/.test(p));
 sources.push(new URL('../scripts/native-check.cjs',import.meta.url).pathname);
 for(const file of sources){
  const text=readFileSync(file,'utf8');
  for(const match of text.matchAll(/\/pages\/[a-z0-9_-]+\/[a-z0-9_-]+/g))assert.ok(registered.has(match[0].slice(1)),`${file}: ${match[0]}`);
  for(const match of text.matchAll(/data-page="([a-z0-9_-]+)"/g))assert.ok(registered.has(`pages/${match[1]}/index`),`${file}: ${match[1]}`);
 }
 for(const tab of config.tabBar.list)assert.ok(registered.has(tab.pagePath));
});

test('共用列表只为实际详情类型提供跳转，点位同页保持只读',()=>{
 const calls=[];const exports={};
 const source=readFileSync(join(root,'lib/list-page.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function('exports','require',compiled)(exports,()=>({go:url=>calls.push(url)}));
 for(const [kind,category,expected] of [['product','instrument','product'],['product','gift','product'],['lesson','','lesson']]){
  const page=exports.listPage(kind,category);
  page.open({currentTarget:{dataset:{id:'sample/one ?'}}});
  assert.equal(calls.at(-1),`/pages/${expected}/index?id=${encodeURIComponent('sample/one ?')}`);
  assert.ok(registered.has(calls.at(-1).slice(1).split('?')[0]));
 }
 const spots=exports.listPage('spot','','琴音之旅');
 assert.equal(spots.open,undefined);
 assert.equal(typeof spots.load,'function');assert.equal(typeof spots.retry,'function');
});
