import {api,Content,decorate,go,message} from './api';
export function detailPage():WechatMiniprogram.Page.Options<any,any>{return {data:{id:'',item:null as Content|null,loading:true,error:'',imageError:false,phone:''},
 onLoad(options:Record<string,string>){this.setData({id:options.id || ''});this.load();},
 async load(){this.setData({loading:true,error:'',imageError:false});try{const [item,site]=await Promise.all([api<Content>('/api/public/content/'+this.data.id),api<Content|null>('/api/public/content/site').catch(()=>null)]);this.setData({item:decorate(item),phone:site?.phone || ''});}catch(e){this.setData({item:null,error:message(e)});}finally{this.setData({loading:false});}},retry(){this.load();},imageError(){this.setData({imageError:true});},
 phone(){if(this.data.phone)wx.makePhoneCall({phoneNumber:this.data.phone,fail:()=>wx.showToast({title:'未拨通，可使用留资咨询',icon:'none'})});},
 consult(){go('/pages/consult/index?id='+this.data.id);},
 preview(e:WechatMiniprogram.TouchEvent){const spec=this.data.item?.specs?.[this.data.selectedSpec];const urls=spec?.images?.length?spec.images:this.data.item?.images || [];if(urls.length)wx.previewImage({urls,current:e.currentTarget.dataset.url || urls[0]});}
};}
