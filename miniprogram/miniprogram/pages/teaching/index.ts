import {listPage} from '../../lib/list-page';
const teaching=listPage('lesson','','教学课堂');
Page({...teaching,filter(){
  teaching.filter.call(this);
  this.setData({items:this.data.items.map((item:any)=>({...item,durationLabel:typeof item.duration==='number' && Number.isFinite(item.duration) && item.duration>0?item.duration.toFixed(2):''}))});
}});
