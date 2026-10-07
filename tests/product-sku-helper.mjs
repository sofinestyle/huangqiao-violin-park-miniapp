// Convert explicit synthetic test inputs to the current write contract; never used in production.
import {productPayload,option} from '../server/sku-seed.mjs';
export function skuWrite(service,actor,p,id){
 if(p.kind!=='product' && (!id||service.content(id,false).kind!=='product'))return service.saveContent(actor,p,id);
 const previous=id?service.content(id,false):null,old=p.data.specs||[],v2=previous?.variantModelVersion===2;
 const data={...p.data};delete data.specs;delete data.skus;
 if(v2){const skus=previous.skus.filter(s=>s.current).map((s,i)=>old[i]?{...s,reference_price:old[i].price??null,images:old[i].images||[]}:s);return service.saveContent(actor,{...p,data:{...data,variantModelVersion:2,variantMode:previous.variantMode,options:previous.options},skus},id);}
 const opts=old.length?[option('规格',old.map(s=>s.name))]:[];const base=productPayload(p.name,opts,data);
 base.skus=base.skus.map((s,i)=>({...s,reference_price:old[i]?.price??null,images:old[i]?.images||[]}));
 return service.saveContent(actor,{...base,...p,data:base.data,skus:base.skus},id);
}
