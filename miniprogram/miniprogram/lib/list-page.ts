import {api,Content,decorate,go,message,INSTRUMENT_CATEGORIES} from './api';
export function listPage(kind:string,category='',title=''):WechatMiniprogram.Page.Options<any,any> {
 const detailRoute=kind==='product'?'product':kind==='lesson'?'lesson':null;
 return {
 data:{title,items:[] as Content[],all:[] as Content[],filters:['全部'] as string[],selected:'全部',q:'',loading:true,error:''},
 onShow(){this.load();},async load(){this.setData({loading:true,error:''});try{const rows=await api<Content[]>('/api/public/content?kind='+kind+(category?'&category='+category:''));const all=rows.map(decorate);this.setData({all,filters:category==='instrument'?['全部',...Object.values(INSTRUMENT_CATEGORIES)]:['全部',...new Set(all.map(c=>c.series || c.category).filter(Boolean))]});this.filter();}catch(e){this.setData({error:message(e)});}finally{this.setData({loading:false});}},
 filter(){const {all,selected,q}=this.data;this.setData({items:all.filter((c:Content)=>(selected==='全部'||(category==='instrument'?INSTRUMENT_CATEGORIES[c.category]:(c.series || c.category))===selected)&&(!q||`${c.name} ${c.code || ''}`.toLowerCase().includes(q.toLowerCase())))});},
 search(e:WechatMiniprogram.CustomEvent<{value:string}>){this.setData({q:e.detail.value});this.filter();},select(e:WechatMiniprogram.TouchEvent){this.setData({selected:e.currentTarget.dataset.filter});this.filter();},retry(){this.load();},
 ...(detailRoute?{open(e:WechatMiniprogram.TouchEvent){go(`/pages/${detailRoute}/index?id=${encodeURIComponent(e.currentTarget.dataset.id)}`);}}:{})
};}
