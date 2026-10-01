import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../server/db.mjs';
import {seed} from '../server/seed.mjs';
import {Service} from '../server/service.mjs';
import {INSTRUMENT_CATEGORIES} from '../shared/status.mjs';
import {migrateContentCopy} from '../server/content-migration.mjs';
import {listMedia} from '../server/media.mjs';
const actor={id:'round1',roles:['admin']};
function fixture(t){const db=openDatabase(':memory:');seed(db);t.after(()=>db.close());return {db,service:new Service(db)};}
test('五类乐器可维护、聚合检索，文创独立，草稿与下架仍隔离',t=>{
  const {service}=fixture(t);
  for(const category of Object.keys(INSTRUMENT_CATEGORIES))service.saveContent(actor,{kind:'product',name:category,state:'published',data:{category,priceMode:'inquiry',specs:[]}});
  const instruments=service.listContent({kind:'product',category:'instrument'});
  assert.equal(instruments.length,12);assert.equal(instruments.some(x=>x.category==='gift'),false);
  assert.deepEqual([...new Set(instruments.map(x=>x.category))].sort(),Object.keys(INSTRUMENT_CATEGORIES).sort());
  assert.equal(service.listContent({kind:'product',category:'gift'}).length,20);
  const item=service.saveContent(actor,{kind:'product',name:'draft guitar',data:{category:'guitar',priceMode:'inquiry',specs:[]}});
  assert.equal(service.listContent({kind:'product',category:'instrument'}).some(x=>x.id===item.id),false);
  service.saveContent(actor,{version:item.version,name:item.name,state:'archived',data:{...item}},item.id);
  assert.equal(service.listContent({category:'instrument'},true).some(x=>x.id===item.id),true);
  assert.throws(()=>service.saveContent(actor,{kind:'product',name:'invalid',data:{category:'invalid',priceMode:'inquiry',specs:[]}}));
});
test('移除生成提示保留内部标记、价格和自填内容；一次性迁移不会覆盖后续维护',t=>{
  const {db,service}=fixture(t);const site=service.content('site');assert.equal(site.notice,'');assert.equal(site.isTest,true);
  assert.equal(service.content('package-1').referenceParentPrice,118);
  const c=service.content('violin-L201');assert.equal(c.description.includes('测试资料'),false);
  db.prepare('DELETE FROM migrations WHERE version=2').run();
  const original={...c,description:'管理员自行填写的产品说明',specs:[{name:'尺寸',description:'真实规格待管理员核实'}]};
  db.prepare('UPDATE content SET data=? WHERE id=?').run(JSON.stringify(original),c.id);migrateContentCopy(db);
  assert.equal(service.content(c.id).description,original.description);assert.deepEqual(service.content(c.id).specs,original.specs);
  const version=service.content(c.id).version;migrateContentCopy(db);assert.equal(service.content(c.id).version,version);
});
test('素材库提供图片、规格图库和视频的关联状态；未关联文件保持可查',t=>{
  const {db,service}=fixture(t);const mediaId=randomUUID(),unused=randomUUID();
  for(const id of [mediaId,unused])db.prepare('INSERT INTO media VALUES (?,?,?,?,?,?,?,?,?)').run(id,'sample.png','image/png',123,'hash',id+'.png','generated',null,new Date().toISOString());
  const c=service.content('violin-L201');service.saveContent(actor,{version:c.version,name:c.name,state:'draft',data:{...c,images:[],specs:[{name:'4/4',description:'',images:['/api/media/'+mediaId]}]}},c.id);
  const list=listMedia(db);assert.equal(list.find(m=>m.id===mediaId).usedBy[0].id,c.id);assert.equal(list.find(m=>m.id===mediaId).usedBy[0].state,'draft');assert.equal(list.find(m=>m.id===unused).usedBy.length,0);
  assert.equal(Object.hasOwn(list[0],'stored_name'),false);
});
test('场次按日期与套餐衔接，暂停场次不可提交；待确认不占用容量',t=>{
  const {db,service}=fixture(t);const visitor={id:randomUUID()};db.prepare('INSERT INTO visitors VALUES (?,NULL,?)').run(visitor.id,new Date().toISOString());
  const slot=service.saveSlot(actor,{date:'2099-11-01',start:'09:00',end:'11:00',capacity:2,packageIds:['package-1'],note:''});
  const payload={packageId:'package-1',date:'2099-11-01',slotId:slot.id,contactName:'虚拟访客',phone:'13800000000',adults:1,children:1,consent:true};
  const r=service.createBooking(visitor,payload,randomUUID());assert.equal(r.state,'pending');assert.equal(service.slots().find(s=>s.id===slot.id).confirmed_count,0);
  assert.throws(()=>service.createBooking(visitor,{...payload,packageId:'package-2'},randomUUID()));
  service.saveSlot(actor,{...slot,packageIds:slot.package_ids,paused:true},slot.id);
  assert.equal(service.slots(true).some(s=>s.id===slot.id),false);assert.throws(()=>service.createBooking(visitor,payload,randomUUID()));
});
test('点位到访咨询的关联对象可保存，并保持本人归属',t=>{
  const {db,service}=fixture(t);const visitor={id:randomUUID()};db.prepare('INSERT INTO visitors VALUES (?,NULL,?)').run(visitor.id,new Date().toISOString());
  const row=service.createConsultation(visitor,{contentId:'spot-1',contactName:'虚拟访客',phone:'13800000000',message:'到访安排',consent:true},randomUUID());
  const record=service.getConsultation(row.id,visitor);assert.equal(record.snapshot.id,'spot-1');assert.equal(record.snapshot.name,'城市客厅');
});
