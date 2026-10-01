import {requireValue,text} from './security.mjs';

export function enrollmentData(value={}) {
  requireValue(value && typeof value==='object' && !Array.isArray(value),'报名活动信息格式错误');
  const state=value.state || 'draft';
  requireValue(['draft','published','archived'].includes(state),'报名发布状态无效');
  return {state,title:text(value.title || '','活动名称',120,true),packageId:text(value.packageId || '','跟团套餐',100,true),
    description:text(value.description || '','活动介绍',5000,true),meetingPoint:text(value.meetingPoint || '','集合地点',300,true),
    feeNote:text(value.feeNote || '','费用说明',500,true),registrationNote:text(value.registrationNote || '','报名说明',1500,true)};
}

// Explicit public fields only: internal notes, participant lists and staff identities stay private.
export function publicEnrollment(slot,pkg,bookingEnabled) {
  const e=slot.enrollment;
  return {id:slot.id,title:e.title,date:slot.date,start:slot.start,end:slot.end,packageId:pkg.id,packageName:pkg.name,
    cover:pkg.images?.[0] || '',description:e.description || pkg.description || '',meetingPoint:e.meetingPoint,
    feeNote:e.feeNote,registrationNote:e.registrationNote,remaining:slot.remaining,version:slot.version,
    canApply:bookingEnabled && slot.remaining>0,availabilityLabel:!bookingEnabled?'报名暂未开放':slot.remaining>0?'可申请跟团':'已满员'};
}
