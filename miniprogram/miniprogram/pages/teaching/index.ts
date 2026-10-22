import {listPage} from '../../lib/list-page';
import {api,Content,decorate,message} from '../../lib/api';
import {TEACHING_TYPE_LABELS,teachingTypeLabel,filterTeachingContent} from '../../lib/teaching-types';
const teaching=listPage('lesson','','教学课堂');
const filters=['全部',...Object.values(TEACHING_TYPE_LABELS)];
Page({...teaching,data:{...teaching.data,filters},async load(){
 this.setData({loading:true,error:''});
 try{
  const rows=await api<Content[]>('/api/public/content?kind=lesson');
  const all=rows.map(item=>({...decorate(item),teachingTypeLabel:teachingTypeLabel({teachingType:item.teachingType,type:item.type}),durationLabel:typeof item.duration==='number' && Number.isFinite(item.duration) && item.duration>0?item.duration.toFixed(2):''}));
  this.setData({all,filters});this.filter();
 }catch(e){this.setData({error:message(e)});}finally{this.setData({loading:false});}
},filter(){
 const {all,selected,q}=this.data;
 this.setData({items:filterTeachingContent(all,selected,q)});
}});
