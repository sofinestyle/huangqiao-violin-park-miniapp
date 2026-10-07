import {randomUUID} from 'node:crypto';
import {Service} from './service.mjs';
import {combinations} from '../shared/sku-model.mjs';
export const option=(name,labels,sort=0)=>({id:randomUUID(),name,sort,enabled:true,values:labels.map((label,sort)=>({id:randomUUID(),label,sort,enabled:true}))});
export function productPayload(name,options=[],extra={}){
 const data={code:'QA-SKU',category:'violin',description:'合成开发测试资料，非正式产品。',images:['/assets/hero-violin.jpg'],priceMode:'reference',price:450,isTest:true,variantModelVersion:2,variantMode:options.length?'options':'simple',options,...extra};
 return {kind:'product',name,state:'draft',sort:0,data,skus:(combinations(data.variantMode,options)||[]).map((option_values,sort_order)=>({sku_code:`QA-${randomUUID().replaceAll('-','').slice(0,20)}`,option_values,reference_price:null,images:[],enabled:true,sort_order}))};
}
export function seedSkuProducts(db){
 const service=new Service(db),actor={id:'system-sku-seed',roles:['admin']},sizes=['1/8','1/4','1/2','3/4','4/4'];const output=[];
 const scenarios=[['SKU-A 单规格小提琴',[]],['SKU-B 五尺寸两颜色',[option('尺寸',sizes),option('颜色',['自然色','棕色'],1)]],['SKU-C 尺寸颜色套装',[option('尺寸',sizes),option('颜色',['自然色','棕色'],1),option('套装',['标准','高级'],2)]],['SKU-D 文创T恤',[option('尺码',['S','M','L','XL']),option('颜色',['黑','白','棕'],1)]],['SKU-E 部分停用组合',[option('尺寸',sizes),option('颜色',['自然色','棕色'],1)]]];
 for(const [name,options] of scenarios){const existing=db.prepare('SELECT id FROM content WHERE name=? AND kind=?').get(name,'product');if(existing){output.push(service.content(existing.id,false));continue;}const p=productPayload(name,options,name.includes('SKU-D')?{category:'gift'}:{});p.state='published';if(name.includes('SKU-E'))p.skus[1].enabled=false;output.push(service.saveContent(actor,p));}
 return output;
}
