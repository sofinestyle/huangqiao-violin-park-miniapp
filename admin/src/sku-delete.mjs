// UI deletion is local removal for draft definitions, retirement for persisted definitions.
export const sameLabel=(a,b)=>a.trim().toLocaleLowerCase()===b.trim().toLocaleLowerCase();
export function persistedDefinition(base,optionId,valueId) {
 const o=base.find(o=>o.id===optionId);return valueId?!!o?.values.some(v=>v.id===valueId):!!o;
}
export function retireDefinition(options,base,optionId,valueId) {
 const persisted=persistedDefinition(base,optionId,valueId);
 return options.flatMap(o=>o.id!==optionId?[o]:valueId?[{...o,values:o.values.flatMap(v=>v.id!==valueId?[v]:persisted?[{...v,enabled:false}]:[])}]:persisted?[{...o,enabled:false}]:[]);
}
export function historicalDefinition(options,optionId,valueId) {
 if(valueId){const o=options.find(o=>o.id===optionId),value=o.values.find(v=>v.id===valueId);return o.values.find(v=>!v.enabled&&v.id!==valueId&&sameLabel(v.label,value.label));}
 const option=options.find(o=>o.id===optionId);return options.find(o=>!o.enabled&&o.id!==optionId&&sameLabel(o.name,option.name));
}
