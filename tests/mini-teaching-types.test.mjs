import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {TEACHING_TYPES,teachingTypeOf as adminTeachingTypeOf} from '../shared/teaching-types.mjs';

const module={exports:{}};
const code=ts.transpileModule(readFileSync('miniprogram/miniprogram/lib/teaching-types.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(code,{module,exports:module.exports});
const {TEACHING_TYPE_LABELS,teachingTypeOf,teachingTypeLabel,filterTeachingContent}=module.exports;

test('Native teaching types match all five Admin values and labels, including empty categories',()=>{
 assert.deepEqual(Object.entries(TEACHING_TYPE_LABELS),Object.entries(TEACHING_TYPES).map(([value,{label}])=>[value,label]));
 for(const teachingType of Object.keys(TEACHING_TYPES)){
  const row={teachingType,type:'video'};
  assert.equal(teachingTypeOf(row),adminTeachingTypeOf(row));
  assert.equal(teachingTypeLabel(row),TEACHING_TYPES[teachingType].label);
 }
});
test('Missing legacy video classification remains visible in All without guessing from title or format',()=>{
 for(const row of [{type:'video'},{type:'video',teachingType:'future_type'},{type:'article'},{type:'course'}])assert.equal(teachingTypeOf(row),adminTeachingTypeOf(row));
 const rows=[{name:'开箱教学字样但没有分类',type:'video'},{name:'Unknown',type:'video',teachingType:'invalid'}];
 assert.equal(teachingTypeLabel(rows[0]),'未分类');
 assert.equal(filterTeachingContent(rows,'全部','').length,2);
 for(const label of Object.values(TEACHING_TYPE_LABELS))assert.equal(filterTeachingContent(rows,label,'').length,0);
});
test('Teaching filters use business type and combine with search while retaining original playback formats',()=>{
 const rows=[{name:'Unboxing',code:'A01',type:'video',teachingType:'unboxing'},{name:'Product',code:'B02',type:'video',teachingType:'product_video'},{name:'Other',type:'video',teachingType:'other'}];
 assert.equal(filterTeachingContent(rows,'开箱教学','a01')[0],rows[0]);
 assert.equal(filterTeachingContent(rows,'产品视频','').length,1);
 assert.equal(filterTeachingContent(rows,'产品视频','Unboxing').length,0);
 assert.equal(filterTeachingContent(rows,'其他','')[0].type,'video');
 assert.equal(filterTeachingContent(rows,'图文教学','').length,0);
 assert.equal(filterTeachingContent(rows,'全部','BOX')[0],rows[0]);
});
