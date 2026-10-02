import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openDatabase} from '../server/db.mjs';
import {seed} from '../server/seed.mjs';
import {Service} from '../server/service.mjs';

const actor={id:'spot-content-test',roles:['content']};
const samples=JSON.parse(readFileSync(new URL('../docs/design/ui-tour-complete-2026-10-02/approved-content.json',import.meta.url),'utf8'));
function fixture(t){const db=openDatabase(':memory:');seed(db);t.after(()=>db.close());return {db,service:new Service(db)};}
function save(service,previous,extra={},actorOverride=actor,state=previous.state){return service.saveContent(actorOverride,{version:previous.version,name:previous.name,state,sort:previous.sort,data:{...previous,...extra}},previous.id);}

test('四站标签和参观项目持久化、公开读取及维护，旧字段和状态保持',t=>{
  const {db,service}=fixture(t);
  for(const sample of samples){
    const before=service.content(sample.id);const after=save(service,before,sample);
    assert.equal(after.description,sample.description);assert.deepEqual(after.tags,sample.tags);assert.deepEqual(after.visitItems,sample.visitItems);
    for(const key of ['id','kind','name','images','opening','visitNote','sort','state','isTest'])assert.deepEqual(after[key],before[key]);
    assert.equal(after.version,before.version+1);assert.deepEqual(service.listContent({kind:'spot'}).find(x=>x.id===sample.id).visitItems,sample.visitItems);
    assert.throws(()=>save(service,before,sample),e=>e.status===409);
    const edited=save(service,after,{visitItems:after.visitItems.map((x,i)=>i===0?{...x,durationNote:'维护后的时长说明'}:x)});
    assert.equal(service.content(sample.id).visitItems[0].durationNote,edited.visitItems[0].durationNote);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit WHERE action='content.update'").get().n,8);
});

test('旧点位无需补字段，空数组可清空，草稿/下架仍不公开',t=>{
  const {service}=fixture(t);const before=service.content('spot-1');assert.equal(Object.hasOwn(before,'tags'),false);
  let row=save(service,before);assert.equal(Object.hasOwn(row,'visitItems'),false);
  row=save(service,row,{tags:[],visitItems:[]});assert.deepEqual(row.tags,[]);assert.deepEqual(row.visitItems,[]);
  for(const state of ['draft','archived']){row=save(service,row,{},actor,state);assert.equal(service.listContent({kind:'spot'}).some(x=>x.id===row.id),false);assert.throws(()=>service.content(row.id),e=>e.status===404);}
  row=save(service,row,{},actor,'published');assert.equal(service.content(row.id).state,'published');
});

test('非法类型、过长及多余字段被拒绝，失败不改变版本或审计',t=>{
  const {db,service}=fixture(t);const before=service.content('spot-1'),valid=samples[0].visitItems[0];
  const invalid=[{tags:null},{tags:'城市客厅'},{tags:[{}]},{tags:[' ']},{tags:['a'.repeat(41)]},{tags:Array(13).fill('标签')},
    {visitItems:null},{visitItems:'项目'},{visitItems:Array(21).fill(valid)},{visitItems:[null]},{visitItems:[[]]},
    ...[{name:''},{name:'a'.repeat(81)},{description:null},{description:'a'.repeat(201)},{durationNote:''},{durationNote:'a'.repeat(41)},{price:1},{durationNote:20}].map(x=>({visitItems:[{...valid,...x}]}))];
  const auditCount=db.prepare('SELECT COUNT(*) AS n FROM audit').get().n;
  for(const fields of invalid){assert.throws(()=>save(service,before,fields),e=>e.status===400);assert.equal(service.content(before.id).version,before.version);}
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit').get().n,auditCount);
});

test('仅点位可维护新字段，接待角色不能写入内容',t=>{
  const {service}=fixture(t);
  for(const kind of ['site','product','package','lesson']){const row=service.listContent({kind},true)[0];assert.ok(row);assert.throws(()=>save(service,row,{tags:[],visitItems:[]}),e=>e.status===400);}
  const row=service.content('spot-1');assert.throws(()=>save(service,row,samples[0],{id:'reception-test',roles:['reception']}),e=>e.status===403);
});
