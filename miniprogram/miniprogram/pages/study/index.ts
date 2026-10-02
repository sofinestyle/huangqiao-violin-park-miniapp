import {api,Content,decorate,go,mediaUrl,message} from '../../lib/api';

Page({
  data:{items:[] as Content[],loading:true,error:'',heroImage:mediaUrl('/assets/workshop.jpg')},
  onShow(){this.load();},
  async load(){
    this.setData({loading:true,error:''});
    try{
      const rows=await api<Content[]>('/api/public/content?kind=package');
      this.setData({items:rows.map(row=>({...decorate(row),
        // New copy uses one item per line; legacy semicolon-separated copy remains readable.
        points:String(row.description || '').split(/\r?\n|[；;]/).map(s=>s.trim().replace(/^[•●·]\s*/, '')).filter(Boolean),
        hasParentPrice:typeof row.referenceParentPrice==='number' && row.referenceParentPrice>=0,
        hasSinglePrice:typeof row.referenceSinglePrice==='number' && row.referenceSinglePrice>=0,
        failedImages:{}
      }))});
    }catch(e){this.setData({items:[],error:message(e)});}
    finally{this.setData({loading:false});}
  },
  retry(){this.load();},
  imageError(e:WechatMiniprogram.TouchEvent){
    const {card,index}=e.currentTarget.dataset;
    this.setData({[`items[${card}].failedImages[${index}]`]:true});
  },
  book(e:WechatMiniprogram.TouchEvent){go('/pages/booking/index?id='+encodeURIComponent(e.currentTarget.dataset.id));},
  enroll(){go('/pages/enrollments/index');},
  group(){go('/pages/booking/index?group=1');}
});
