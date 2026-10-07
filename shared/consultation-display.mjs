// New immutable snapshot wins even if its label is intentionally empty (simple).
export const getConsultationSpecDisplay=snapshot=>snapshot?.sku? snapshot.sku.specLabel||'':snapshot?.spec||'';
