import {randomUUID} from 'node:crypto';
import {Fault} from './security.mjs';
import {activeOptions,combinationKey,combinations,planSkus,skuLabel} from '../shared/sku-model.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function check(ok,message,field='options',status=400,code='INVALID_SKU'){if(!ok){const e=new Fault(status,message,code);e.field=field;throw e;}}
const sort=n=>Number.isInteger(n)&&n>=0&&n<=10000;
const object=x=>x && typeof x==='object' && !Array.isArray(x);
function label(value,field){check(typeof value==='string' && value.trim().length>0 && value.trim().length<=40,'规格名称/值须为1—40个字符',field);return value.trim();}
export function validateImages(db,images,field){
 check(Array.isArray(images)&&images.length<=12,'图片最多12张',field);
 for(const url of images){check(typeof url==='string'&&/^\/(assets\/[a-zA-Z0-9_.-]+|api\/media\/[a-zA-Z0-9-]+)$/.test(url),'请使用已上传或项目已有图片',field);
 if(url.startsWith('/api/media/'))check(db.prepare('SELECT mime FROM media WHERE id=?').get(url.split('/').at(-1))?.mime.startsWith('image/'),'关联图片不存在或不是图片',field);}
}
export function skuRows(db,id){return db.prepare('SELECT * FROM product_skus WHERE product_id=? ORDER BY sort_order,id').all(id).map(s=>({...s,enabled:!!s.enabled,option_values:JSON.parse(s.option_values),images:JSON.parse(s.images)}));}
export function readSkuProduct(db,product,publicRead=false,rows){
 if(product.kind!=='product'||product.variantModelVersion!==2)return product;
 const keys=new Set((combinations(product.variantMode,product.options)||[]).map(combinationKey));
 const skus=(rows||skuRows(db,product.id)).map(s=>({...s,current:keys.has(combinationKey(s.option_values)),label:skuLabel(s.option_values,product.options),effectiveReferencePrice:product.priceMode==='reference'?(s.reference_price??product.price):null,effectiveImages:s.images.length?s.images:(product.images||[])}));
 const visible=skus.filter(s=>s.current&&s.enabled);
 const specs=visible.map(s=>({name:s.label,description:'',...(product.priceMode==='reference'?{price:s.effectiveReferencePrice}:{}),images:s.images}));
 return {...product,...(publicRead&&product.priceMode==='inquiry'?{price:null}:{}),skus:publicRead?visible.map(({disable_reason,combination_key,...s})=>({...s,...(product.priceMode==='inquiry'?{reference_price:null}:{})})):skus,specs};
}
export function prepareSkuSave(db,productId,data,input,previous){
 check(data.variantModelVersion===2 && ['simple','options'].includes(data.variantMode) && !Object.hasOwn(data,'specs'),'产品已使用新版规格模型，请刷新或使用新版后台维护。','variantMode',400,'MODEL_UPGRADE_REQUIRED');
 check(Array.isArray(data.options)&&data.options.length<=100,'规格维度数据无效');
 const ids=new Set(),names=new Set(),oldOptions=previous?.options||[];
 const options=data.options.map(o=>{
  check(object(o)&&uuid.test(o.id)&&!ids.has(o.id),'规格维度ID重复或无效');ids.add(o.id);
  const name=label(o.name,`option:${o.id}`),fold=name.toLowerCase();check(!names.has(fold),'规格维度名称重复',`option:${o.id}`);names.add(fold);
  check(typeof o.enabled==='boolean'&&sort(o.sort),'维度启停或排序无效',`option:${o.id}`);
  check(Array.isArray(o.values)&&o.values.length<=200,'规格值数据无效',`option:${o.id}`);const labels=new Set();
  const values=o.values.map(v=>{check(object(v)&&uuid.test(v.id)&&!ids.has(v.id),'规格值ID重复或无效',`option:${o.id}`);ids.add(v.id);const val=label(v.label,`value:${v.id}`),key=val.toLowerCase();check(!labels.has(key),'同一维度规格值重复',`value:${v.id}`);labels.add(key);check(typeof v.enabled==='boolean'&&sort(v.sort),'规格值启停或排序无效',`value:${v.id}`);return {id:v.id,label:val,sort:v.sort,enabled:v.enabled};});
  check(values.filter(v=>v.enabled).length<=20,'每维最多20个启用规格值',`option:${o.id}`);
  if(o.enabled)check(values.some(v=>v.enabled),'启用维度至少需要一个启用规格值',`option:${o.id}`);
  return {id:o.id,name,sort:o.sort,enabled:o.enabled,values};
 });
 for(const old of oldOptions){const n=options.find(o=>o.id===old.id);check(n,'已有维度不能删除，请停用',`option:${old.id}`);for(const v of old.values)check(n.values.some(x=>x.id===v.id),'已有规格值不能删除或移属，请停用',`value:${v.id}`);}
 check(activeOptions(options).length<=3,'最多3个启用规格维度');
 if(data.variantMode==='options')check(activeOptions(options).length>0,'多规格至少需要一个启用维度');
 if(data.variantMode==='simple')check(activeOptions(options).length===0,'单规格模式请停用规格维度');
 const previousRows=previous?.variantModelVersion===2?readSkuProduct(db,previous,false).skus:[];
 const plan=planSkus(data.variantMode,options,previous?.variantMode,previousRows,()=>`SKU-${randomUUID().replaceAll('-','').slice(0,20)}`);check(!plan.error,plan.error||'规格组合无效');
 check(Array.isArray(input)&&input.length===plan.current.length,'请更新组合；提交的SKU数量与规格组合不一致','skus');
 const expected=new Map(plan.current.map(s=>[combinationKey(s.option_values),s])),seen=new Set(),codes=new Set(),skuIds=new Set();
 const rows=input.map(s=>{
  check(object(s)&&object(s.option_values),'SKU组合无效','skus');const key=combinationKey(s.option_values),field=`sku:${key}`;
  check(expected.has(key)&&!seen.has(key),'SKU组合重复、不完整或包含未知规格值',field);seen.add(key);const target=expected.get(key);
  check(s.id==null || (uuid.test(s.id)&&target.id===s.id&&!skuIds.has(s.id)),'SKU身份无效或不属于本产品/组合',field);if(target.id)check(s.id===target.id,'已有SKU必须保留原身份',field);if(s.id)skuIds.add(s.id);
  check(typeof s.sku_code==='string','SKU编码不能为空',field+':sku_code');const code=s.sku_code.trim();check(/^[A-Za-z0-9_-]{1,64}$/.test(code),'SKU编码须为1—64位字母、数字、短横线或下划线',field+':sku_code');
  const conflict=db.prepare('SELECT id FROM product_skus WHERE sku_code=? COLLATE NOCASE').get(code);
  check(!codes.has(code.toLowerCase())&&(!conflict || conflict.id===target.id),'SKU编码已被使用',field+':sku_code',409,'SKU_CODE_CONFLICT');codes.add(code.toLowerCase());
  check(s.reference_price===null || (typeof s.reference_price==='number'&&Number.isFinite(s.reference_price)&&s.reference_price>=0&&s.reference_price<=1e7),'SKU参考价须为空或0—10000000的有限数字',field+':reference_price');
  validateImages(db,s.images,field+':images');check(typeof s.enabled==='boolean','SKU启用状态须为布尔值',field+':enabled');check(sort(s.sort_order),'SKU排序须为0—10000整数',field+':sort_order');
  if(data.variantMode==='simple')check(s.enabled,'单规格SKU必须启用',field+':enabled');
  return {id:target.id||randomUUID(),product_id:productId,sku_code:code,option_values:s.option_values,combination_key:key,reference_price:s.reference_price,images:s.images,enabled:s.enabled,sort_order:target.sort_order,disable_reason:s.enabled?'':'manual'};
 });
 return {options,rows:[...rows,...plan.retired.map(s=>({...s,combination_key:combinationKey(s.option_values)}))],previousRows};
}
export function writeSkus(db,plan){
 const now=new Date().toISOString(),counts={created:0,updated:0,disabled:0};
 const insert=db.prepare('INSERT INTO product_skus(id,product_id,sku_code,option_values,combination_key,reference_price,images,enabled,sort_order,disable_reason,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
 const update=db.prepare('UPDATE product_skus SET sku_code=?,option_values=?,combination_key=?,reference_price=?,images=?,enabled=?,sort_order=?,disable_reason=?,updated_at=? WHERE id=?');
 for(const s of plan.rows){const old=plan.previousRows.find(x=>x.id===s.id);const args=[s.sku_code,JSON.stringify(s.option_values),s.combination_key,s.reference_price,JSON.stringify(s.images),+s.enabled,s.sort_order,s.disable_reason];
 if(old){const changed=old.sku_code!==s.sku_code || combinationKey(old.option_values)!==s.combination_key || old.reference_price!==s.reference_price || JSON.stringify(old.images)!==JSON.stringify(s.images) || old.enabled!==s.enabled || old.sort_order!==s.sort_order || old.disable_reason!==s.disable_reason;
 if(changed){update.run(...args,now,s.id);counts.updated++;if(old.enabled&&!s.enabled)counts.disabled++;}}
 else{insert.run(s.id,s.product_id,...args,now,now);counts.created++;}}
 return counts;
}
