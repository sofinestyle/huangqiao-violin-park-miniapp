// Pure structure helpers shared by preview and server; server validates all inputs independently.
export const combinationKey = values => JSON.stringify(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)));
export const ordered = rows => [...rows].sort((a,b)=>a.sort-b.sort || a.id.localeCompare(b.id));
export const activeOptions = options => ordered(options.filter(o=>o.enabled));
export function combinations(mode,options) {
 if(mode==='simple')return [{}];
 const active=activeOptions(options);
 if(!active.length || active.some(o=>!o.values.some(v=>v.enabled)))return [];
 let rows=[{}];
 for(const o of active){const values=ordered(o.values.filter(v=>v.enabled));if(rows.length*values.length>50)return null;rows=rows.flatMap(r=>values.map(v=>({...r,[o.id]:v.id})));}
 return rows;
}
export function skuLabel(values,options){return ordered(options).filter(o=>values[o.id]).map(o=>o.values.find(v=>v.id===values[o.id])?.label || '已停用规格').join(' / ') || '默认规格';}
export function planSkus(mode,options,oldMode,previous,makeCode=()=>`SKU-${globalThis.crypto.randomUUID().slice(0,18).replaceAll('-','')}`) {
 const targets=combinations(mode,options);if(!targets || !targets.length)return {current:[],retired:previous,error:targets?'请为每个启用维度添加至少一个启用规格值':'规格组合超过50个，无法生成或保存'};
 const used=new Set(),byKey=new Map(previous.map(s=>[combinationKey(s.option_values),s]));
 const selected=mode==='simple' && oldMode==='options'?previous.filter(s=>s.current!==false && s.enabled):[];
 if(mode==='simple' && oldMode==='options' && selected.length!==1)return {current:[],retired:previous,error:'当前存在多个启用SKU或没有启用SKU，请先调整为一个启用规格组合。'};
 const first=Object.fromEntries(activeOptions(options).map(o=>[o.id,ordered(o.values.filter(v=>v.enabled))[0]?.id]));
 const current=targets.map((values,index)=>{
  const key=combinationKey(values);let old=byKey.get(key);
  if(mode==='simple' && oldMode==='options'){
   if(old && old.id!==selected[0].id)throw new Error('历史单规格身份已存在，请恢复原SKU后再转换，不能自动合并身份');
   old=selected[0];
  }
  if(!old)old=previous.find(s=>!used.has(s) && s.current!==false && (s.enabled || s.disable_reason==='manual') && Object.keys(s.option_values).length<Object.keys(values).length && Object.entries(s.option_values).every(([k,v])=>values[k]===v) && Object.keys(values).filter(k=>!(k in s.option_values)).every(k=>values[k]===first[k]));
  if(old)used.add(old);
  return {...(old || {sku_code:makeCode(),reference_price:null,images:[],enabled:true}),option_values:values,sort_order:index,current:true,enabled:mode==='simple'?true:old?.disable_reason==='structure'?true:(old?.enabled??true),disable_reason:old?.disable_reason==='manual'?'manual':''};
 });
 return {current,retired:previous.filter(s=>!used.has(s)).map(s=>({...s,enabled:false,current:false,disable_reason:s.disable_reason==='manual'?'manual':'structure'})),error:null};
}
