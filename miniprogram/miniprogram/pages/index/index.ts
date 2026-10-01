import {api,Content,decorate,go,message} from '../../lib/api';
Page({data:{site:null as Content|null,packages:[] as Content[],spots:[] as Content[],stats:{packages:0,gifts:0,series:0},loading:true,error:''},
 onShow(){this.load();},
 async load(){this.setData({loading:true,error:''});try{const rows=await api<Content[]>('/api/public/content');const site=rows.find(c=>c.kind==='site');if(!site)throw new Error('首页内容暂未发布，请稍后再试');this.setData({site:site?decorate(site):null,packages:rows.filter(c=>c.kind==='package'&&c.highlight).map(decorate),spots:rows.filter(c=>c.kind==='spot').map(decorate),stats:{packages:rows.filter(c=>c.kind==='package').length,gifts:rows.filter(c=>c.kind==='product'&&c.category==='gift').length,series:new Set(rows.filter(c=>c.kind==='product'&&c.category==='violin'&&c.series).map(c=>c.series)).size}});}catch(e){this.setData({error:message(e)});}finally{this.setData({loading:false});}},retry(){this.load();},
 open(e:WechatMiniprogram.TouchEvent){go(`/pages/${e.currentTarget.dataset.page}/index${e.currentTarget.dataset.id?'?id='+e.currentTarget.dataset.id:''}`);},
 tab(e:WechatMiniprogram.TouchEvent){wx.switchTab({url:`/pages/${e.currentTarget.dataset.page}/index`});}
});
