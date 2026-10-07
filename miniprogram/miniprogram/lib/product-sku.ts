export interface ProductOptionValue {id:string;label:string;sort:number}
export interface ProductOption {id:string;name:string;sort:number;values:ProductOptionValue[]}
export interface PublicSku {id:string;optionValues:Record<string,string>;effectiveReferencePrice:number|null;effectiveImages:string[]}
export interface Product {id:string;kind:'product';name:string;code?:string;category:string;brand?:string;series?:string;description?:string;images:string[];priceMode:'reference'|'inquiry';price?:number;priceNote?:string;variantMode:'simple'|'options'|null;options:ProductOption[];skus:PublicSku[]}
export type Selection=Record<string,string>;
export const orderedOptions=(p:Product)=>[...p.options].sort((a,b)=>a.sort-b.sort).map(o=>({...o,values:[...o.values].sort((a,b)=>a.sort-b.sort)}));
export function currentSkus(p:Product):PublicSku[]{
 const options=orderedOptions(p);
 if(p.variantMode==='simple')return p.skus.filter(s=>Object.keys(s.optionValues).length===0);
 if(p.variantMode!=='options'||!options.length)return [];
 return p.skus.filter(s=>Object.keys(s.optionValues).length===options.length&&options.every(o=>o.values.some(v=>v.id===s.optionValues[o.id]))).sort((a,b)=>{for(const o of options){const delta=o.values.findIndex(v=>v.id===a.optionValues[o.id])-o.values.findIndex(v=>v.id===b.optionValues[o.id]);if(delta)return delta;}return 0;});
}
export function resolveSku(p:Product,selected:Selection):{sku:PublicSku|null;error:string}{
 const keys=orderedOptions(p).map(o=>o.id);
 if(p.variantMode==='options'&&(Object.keys(selected).length!==keys.length||keys.some(k=>!selected[k])))return {sku:null,error:''};
 const matches=currentSkus(p).filter(s=>keys.every(k=>s.optionValues[k]===selected[k]));
 if(matches.length>1)return {sku:null,error:'SKU_COMBINATION_AMBIGUOUS'};
 return {sku:matches[0]||null,error:''};
}
export function valueAvailable(p:Product,selected:Selection,optionId:string,valueId:string){
 return currentSkus(p).some(s=>s.optionValues[optionId]===valueId&&Object.entries(selected).every(([k,v])=>k===optionId||s.optionValues[k]===v));
}
export function skuState(p:Product,selected?:Selection){
 const candidates=currentSkus(p),selection=selected??{...(candidates[0]?.optionValues||{})},resolved=resolveSku(p,selection),sku=resolved.sku;
 const options=orderedOptions(p).map(o=>({...o,values:o.values.map(v=>({...v,selected:selection[o.id]===v.id,disabled:!valueAvailable(p,selection,o.id,v.id)}))}));
 const reference=sku?sku.effectiveReferencePrice:(typeof p.price==='number'?p.price:null);
 const label=sku&&p.variantMode==='options'?options.map(o=>o.values.find(v=>v.id===sku.optionValues[o.id])?.label||'').join(' / '):'';
 return {selectedOptionValues:selection,selectedSku:sku,selectedSkuId:sku?.id||'',optionGroups:options,specLabel:label,
 galleryImages:sku?.effectiveImages.length?sku.effectiveImages:p.images||[],displayReferencePrice:p.priceMode==='reference'?reference:null,
 priceLabel:p.priceMode==='reference'&&reference!==null?`参考价 ¥${reference}`:'咨询报价',
 canConsult:!!sku&&!resolved.error,skuError:resolved.error,skuNotice:resolved.error?'规格资料暂不可用，请稍后重试':!candidates.length?'当前规格暂不可咨询':!sku?'请选择完整规格':''};
}
