// Keep the native labels compatible with shared/teaching-types.mjs; the contract test checks both.
export const TEACHING_TYPE_LABELS = {
 unboxing:'开箱教学',
 product_video:'产品视频',
 violin_course:'提琴课程',
 article:'图文教学',
 other:'其他'
} as const;

type TeachingType = keyof typeof TEACHING_TYPE_LABELS;
interface TeachingClassification {teachingType?:unknown;type?:unknown}

export function teachingTypeOf(content:TeachingClassification):TeachingType|'' {
 if(typeof content.teachingType==='string'&&Object.prototype.hasOwnProperty.call(TEACHING_TYPE_LABELS,content.teachingType))return content.teachingType as TeachingType;
 // Match the Admin's legacy article/course fallback without guessing a category for old videos.
 return content.type==='article'?'article':content.type==='course'?'violin_course':'';
}
export function teachingTypeLabel(content:TeachingClassification):string {
 const type=teachingTypeOf(content);
 return type?TEACHING_TYPE_LABELS[type]:'未分类';
}
export function filterTeachingContent<T extends TeachingClassification & {name:string;code?:unknown}>(content:T[],selected:string,query:string):T[] {
 return content.filter(item=>(selected==='全部'||teachingTypeLabel(item)===selected)&&(!query||`${item.name} ${item.code || ''}`.toLowerCase().includes(query.toLowerCase())));
}
