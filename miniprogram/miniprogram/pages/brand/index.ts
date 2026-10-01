import {api,Content,decorate,go,message} from '../../lib/api';
Page({
 data:{site:null as Content|null,loading:true,error:''},
 onLoad(){this.load();},
 async load(){this.setData({loading:true,error:''});try{const rows=await api<Content[]>('/api/public/content?kind=site');this.setData({site:rows[0]?decorate(rows[0]):null});}catch(e){this.setData({error:message(e)});}finally{this.setData({loading:false});}},
 retry(){this.load();},
 instruments(){go('/pages/instruments/index');},
 consult(){go('/pages/consult/index');}
});
