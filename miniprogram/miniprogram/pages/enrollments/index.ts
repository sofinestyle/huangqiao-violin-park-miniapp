import {api,Enrollment,mediaUrl,go,message} from '../../lib/api';
Page({data:{all:[] as Enrollment[],items:[] as Enrollment[],date:'',loading:true,error:''},
 onShow(){this.load();},async load(){this.setData({loading:true,error:''});try{const rows=await api<Enrollment[]>('/api/public/enrollments');this.setData({all:rows.map(r=>({...r,cover:mediaUrl(r.cover)}))});this.filter();}catch(e){this.setData({error:message(e)});}finally{this.setData({loading:false});}},retry(){this.load();},
 filter(){this.setData({items:this.data.all.filter(r=>!this.data.date || r.date===this.data.date)});},date(e:WechatMiniprogram.CustomEvent<{value:string}>){this.setData({date:e.detail.value});this.filter();},clear(){this.setData({date:''});this.filter();},
 open(e:WechatMiniprogram.TouchEvent){go('/pages/enrollment/index?id='+encodeURIComponent(e.currentTarget.dataset.id));}
});
