export const BOOKING_STATES = { pending: '待确认', confirmed: '已确认待到访', completed: '已完成', cancelled: '已取消', rejected: '无法接待', no_show: '未到访' };
export const CONSULTATION_STATES = { pending: '待处理', following: '跟进中', closed: '已结束' };
export const CONTENT_KINDS = { site: '首页与企业', product: '产品', package: '研学套餐', lesson: '教学内容', spot: '点位导览' };
export const INSTRUMENT_CATEGORIES = { violin: '提琴', guitar: '吉他', ukulele: '尤克里里', harmonica: '口琴', other: '其他' };
export const PRODUCT_CATEGORIES = { ...INSTRUMENT_CATEGORIES, gift: '文创' };
