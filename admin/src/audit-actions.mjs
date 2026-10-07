// Display only. API filters and stored audit actions always use the original code.
export const AUDIT_ACTION_LABELS=Object.freeze({
 'account.login':'工作人员登录','account.create':'创建工作人员账号','account.update':'更新工作人员账号',
 'content.create':'创建内容','content.update':'更新内容','content.delete':'删除内容','slot.save':'保存研学场次',
 'media.upload':'上传素材','records.export':'导出名单',
 'booking.withdraw':'游客撤回预约','booking.change.request':'提交预约变更申请',
 'booking.assign':'指派接待负责人','booking.followup':'登记预约跟进','booking.confirm':'确认研学预约',
 'booking.reject':'无法接待','booking.arrive':'登记到访','booking.complete':'完成接待',
 'booking.no_show':'登记未到访','booking.cancel':'人工取消预约',
 'booking.change_approve':'批准预约变更','booking.change_reject':'拒绝预约变更',
 'consultation.assign':'指派咨询负责人','consultation.followup':'登记咨询跟进','consultation.close':'结束咨询',
 'schema.slot-enrollment.migrate':'迁移研学报名结构','content.default-copy.migrate':'迁移默认内容文案',
});
export const auditActionLabel=action=>Object.hasOwn(AUDIT_ACTION_LABELS,action)?AUDIT_ACTION_LABELS[action]:action;
