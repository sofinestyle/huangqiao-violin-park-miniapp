Component({
 data:{selected:0,tabs:[
  {path:'/pages/index/index',text:'首页',icon:'home'},
  {path:'/pages/instruments/index',text:'乐器',icon:'instrument'},
  {path:'/pages/gifts/index',text:'文创',icon:'gift'},
  {path:'/pages/study/index',text:'研学',icon:'study'},
  {path:'/pages/mine/index',text:'我的',icon:'mine'}
 ]},
 lifetimes:{attached(){this.syncSelected();},ready(){this.syncSelected();}},
 pageLifetimes:{show(){this.syncSelected();}},
 methods:{
  syncSelected(){const pages=getCurrentPages();const page=pages[pages.length-1];if(!page)return;const selected=this.data.tabs.findIndex(t=>t.path==='/'+page.route);if(selected>=0)this.setData({selected});},
  select(e:WechatMiniprogram.TouchEvent){const i=Number(e.currentTarget.dataset.index);const tab=this.data.tabs[i];if(!tab)return;wx.switchTab({url:tab.path,success:()=>this.syncSelected(),fail:()=>wx.showToast({title:'页面打开失败，请重试',icon:'none'})});}
 }
});
