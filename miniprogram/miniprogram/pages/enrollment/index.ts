import {api,Enrollment,mediaUrl,go,message} from '../../lib/api';
Page({data:{id:'',item:null as Enrollment|null,loading:true,error:''},onLoad(options:Record<string,string>){this.setData({id:options.id || ''});},onShow(){this.load();},async load(){this.setData({loading:true,error:''});try{const item=await api<Enrollment>('/api/public/enrollments/'+encodeURIComponent(this.data.id));this.setData({item:{...item,cover:mediaUrl(item.cover)}});}catch(e){this.setData({item:null,error:message(e)});}finally{this.setData({loading:false});}},retry(){this.load();},
 apply(){if(this.data.item?.canApply)go('/pages/booking/index?enrollmentId='+encodeURIComponent(this.data.id));}
});
