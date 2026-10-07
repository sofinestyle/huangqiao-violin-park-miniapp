// Same immutable-snapshot contract as shared/consultation-display.mjs; tested together.
export interface ConsultationSnapshot {spec?:string;sku?:{specLabel:string;referencePrice:number|null}}
export const getConsultationSpecDisplay=(snapshot:ConsultationSnapshot|null|undefined)=>snapshot?.sku?snapshot.sku.specLabel||'':snapshot?.spec||'';
