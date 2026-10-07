import {requireValue} from './security.mjs';
import {activeOptions,ordered} from '../shared/sku-model.mjs';
import {visibleProductSkus} from './public-product.mjs';
export function productConsultationSnapshot(db,product,skuId){
 requireValue(typeof skuId==='string'&&skuId.trim().length>0,'请选择产品规格',400,'SKU_REQUIRED');
 requireValue(skuId.length<=64,'规格不存在',404,'SKU_NOT_FOUND');
 const identity=db.prepare('SELECT product_id FROM product_skus WHERE id=?').get(skuId);
 requireValue(identity,'规格不存在，请重新选择',404,'SKU_NOT_FOUND');
 requireValue(identity.product_id===product.id,'规格不属于当前产品',400,'SKU_PRODUCT_MISMATCH');
 const sku=visibleProductSkus(db,product).find(s=>s.id===skuId);
 requireValue(sku,'该规格已更新，请重新选择。',409,'SKU_UNAVAILABLE');
 const options=product.variantMode==='options'?activeOptions(product.options).map(o=>{const v=ordered(o.values.filter(v=>v.enabled)).find(v=>v.id===sku.option_values[o.id]);return {optionId:o.id,optionName:o.name,valueId:v.id,valueLabel:v.label};}):[];
 return {id:product.id,name:product.name,code:product.code||'',category:product.category||'',version:product.version,
 sku:{id:sku.id,code:sku.sku_code,specLabel:options.map(o=>o.valueLabel).join(' / '),options,referencePrice:sku.effectiveReferencePrice??null}};
}
