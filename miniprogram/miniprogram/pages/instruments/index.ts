import {listPage} from '../../lib/list-page';
const page=listPage('product','instrument','乐器展示');
const originalOnShow=page.onShow;
page.onShow=function(){
 const entry=wx.getStorageSync('hq-home-instrument-filter');
 wx.removeStorageSync('hq-home-instrument-filter');
 if(entry==='violin')this.setData({selected:'提琴',q:''});
 originalOnShow?.call(this);
};
Page(page);
