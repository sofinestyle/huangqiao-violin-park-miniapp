import {detailPage} from '../../lib/detail-page';
import {api,Content,decorate,go,message} from '../../lib/api';
import {Product,Selection,skuState,valueAvailable} from '../../lib/product-sku';
const base=detailPage();
Page({...base,data:{...base.data,selectedSku:null,selectedSkuId:'',selectedOptionValues:{} as Selection,optionGroups:[],specLabel:'',canConsult:false,skuNotice:'',skuError:'',priceLabel:'',galleryCurrent:0},
 async load(){this.setData({loading:true,error:'',imageError:false,canConsult:false});try{const [raw,site]=await Promise.all([api<Product>('/api/public/content/'+this.data.id),api<Content|null>('/api/public/content/site').catch(()=>null)]);const item=decorate(raw) as Product&Content;const state=skuState(item);if(state.skuError)console.error('Product SKU resolution failed',state.skuError);this.setData({item,...state,galleryCurrent:0,phone:site?.phone||''});}catch(e){this.setData({item:null,error:message(e)});}finally{this.setData({loading:false});}},
 select(e:WechatMiniprogram.TouchEvent){const {optionId,valueId}=e.currentTarget.dataset,p=this.data.item as Product;if(!p||!valueAvailable(p,this.data.selectedOptionValues,optionId,valueId))return;const state=skuState(p,{...this.data.selectedOptionValues,[optionId]:valueId});if(state.skuError)console.error('Product SKU resolution failed',state.skuError);this.setData({...state,galleryCurrent:0,imageError:false});},
 resetSelection(){if(this.data.item)this.setData({...skuState(this.data.item as Product,{}),galleryCurrent:0,imageError:false});},
 galleryChange(e:WechatMiniprogram.CustomEvent<{current:number}>){this.setData({galleryCurrent:e.detail.current});},
 consult(){if(this.data.canConsult&&this.data.selectedSkuId)go(`/pages/consult/index?id=${encodeURIComponent(this.data.id)}&skuId=${encodeURIComponent(this.data.selectedSkuId)}&source=${encodeURIComponent('产品详情')}`);}
});
