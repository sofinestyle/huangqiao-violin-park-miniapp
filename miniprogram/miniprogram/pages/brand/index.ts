import {api,Content,decorate,message} from '../../lib/api';
// Presentation only: remove the repeated company heading and retain all backend copy.
function introParagraphs(intro: unknown): string[] {
 const text=String(intro || '').replace(/^江苏黄桥乐器文化产业园投资发展有限公司[，,\s]*/, '');
 return text.replace(/。(?=从一块云杉)/g,'。\n').split(/\n+/).filter(Boolean);
}
Page({
 data:{site:null as Content|null,loading:true,error:'',introParagraphs:[] as string[],heroFailed:false,buildingFailed:false},
 onLoad(){this.load();},
 async load(){this.setData({loading:true,error:''});try{const rows=await api<Content[]>('/api/public/content?kind=site');const site=rows[0]?decorate(rows[0]):null;this.setData({site,introParagraphs:introParagraphs(site?.intro)});}catch(e){this.setData({error:message(e)});}finally{this.setData({loading:false});}},
 retry(){this.load();},
 readCulture(){
  // Leave the 55px sticky brand bar above the destination heading.
  wx.createSelectorQuery().select('#brand-culture').boundingClientRect().selectViewport().scrollOffset().exec(([section,viewport])=>{
   if(section && viewport)wx.pageScrollTo({scrollTop:Math.max(0,section.top+viewport.scrollTop-55),duration:300});
  });
 },
 heroError(){this.setData({heroFailed:true});},
 buildingError(){this.setData({buildingFailed:true});}
});
