// Business classification is separate from the existing article/video/course format.
export const TEACHING_TYPES = {
  unboxing: {label:'开箱教学',format:'video'},
  product_video: {label:'产品视频',format:'video'},
  violin_course: {label:'提琴课程',format:'course'},
  article: {label:'图文教学',format:'article'},
  other: {label:'其他',format:null}
};

export function teachingTypeOf(content) {
  if(Object.hasOwn(TEACHING_TYPES,content.teachingType))return content.teachingType;
  // Do not assign a business category to legacy videos without an explicit choice.
  return content.type==='article'?'article':content.type==='course'?'violin_course':'';
}

export function selectTeachingType(content,teachingType) {
  if(typeof teachingType!=='string' || !Object.hasOwn(TEACHING_TYPES,teachingType))throw new Error('请选择有效的教学内容类型');
  const choice=TEACHING_TYPES[teachingType];
  return {...content,teachingType,type:choice.format || content.type || 'article'};
}
