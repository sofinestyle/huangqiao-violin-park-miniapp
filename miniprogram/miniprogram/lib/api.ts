import {getConsultationSpecDisplay, ConsultationSnapshot} from './consultation-display';
import {getEnvironment,visitorTokenKey,hasVisitorIdentity} from '../config';
export interface Content { id: string; kind: string; name: string; images?: string[]; [key: string]: any }
export interface Enrollment {id:string;title:string;date:string;start:string;end:string;packageId:string;packageName:string;cover:string;description:string;meetingPoint:string;feeNote:string;registrationNote:string;remaining:number;canApply:boolean;availabilityLabel:string;version:number}
export interface BusinessRecord { id: string; state: string; snapshot: (Content & ConsultationSnapshot) | null; request: Record<string, any>; confirmed?: Record<string, any>; changes?: any[]; [key: string]: any }
export class RequestError extends Error { status: number; code: string; constructor(message: string,status: number,code=''){super(message);this.status=status;this.code=code;} }
export function api<T>(path: string, options: { method?: 'GET'|'POST'; data?: object; auth?: boolean; key?: string } = {}): Promise<T> {
 let base:string,tokenKey:string;
 try{base=getEnvironment().apiBase;tokenKey=visitorTokenKey();if(!path.startsWith('/api/')||/[\\\r\n]/.test(path))throw new Error('API路径无效');}catch(e){return Promise.reject(e);}
 const token=wx.getStorageSync(tokenKey);
 return new Promise((resolve,reject)=>wx.request({url:base+path,method:options.method || 'GET',data:options.data,
 header:{'Content-Type':'application/json',...(options.auth && token?{Authorization:`Bearer ${token}`} : {}),...(options.key?{'Idempotency-Key':options.key}:{})},timeout:10000,
 success(res){if(res.statusCode>=200&&res.statusCode<300)resolve(res.data as T);else{if(res.statusCode===401)wx.removeStorageSync(tokenKey);reject(new RequestError((res.data as {error?:string})?.error || '请求失败，请重试',res.statusCode,(res.data as {code?:string})?.code||''));}},
 fail(){reject(new RequestError('暂时无法连接服务，请稍后重试',0));}
 }));
}
export async function ensureIdentity(): Promise<void> {
 if(hasVisitorIdentity())return;
 let result: {token:string};
 if(getEnvironment().identityMode==='development')result=await api('/api/auth/development',{method:'POST'});
 else {const code=await new Promise<string>((resolve,reject)=>wx.login({success:r=>resolve(r.code),fail:()=>reject(new Error('微信登录失败，请重试'))}));result=await api('/api/auth/wechat',{method:'POST',data:{code}});}
 wx.setStorageSync(visitorTokenKey(),result.token);
}
export const INSTRUMENT_CATEGORIES:Record<string,string>={violin:'提琴',guitar:'吉他',ukulele:'尤克里里',harmonica:'口琴',other:'其他'};
export const mediaUrl=(url?:string)=>url?getEnvironment().apiBase+url:'';
export function decorate(c:Content):Content {return {...c,categoryLabel:INSTRUMENT_CATEGORIES[c.category] || (c.category==='gift'?'文创':c.category),images:(c.images || []).map(mediaUrl),skus:c.skus?.map((s:import('./product-sku').PublicSku)=>({...s,effectiveImages:s.effectiveImages.map(mediaUrl)})),cover:mediaUrl(c.images?.[0]),priceLabel:c.priceMode==='reference'&&typeof c.price==='number'?`参考价 ¥${c.price}`:'咨询报价',videoUrl:c.mediaId?mediaUrl(`/api/media/${c.mediaId}`):''};}
export const newKey=()=>`hq_${Date.now()}_${Math.random().toString(36).slice(2,14)}`;
export const BOOKING_LABELS:Record<string,string>={pending:'待确认',confirmed:'已确认待到访',completed:'已完成',cancelled:'已取消',rejected:'无法接待',no_show:'未到访'};
export const CONSULTATION_LABELS:Record<string,string>={pending:'待处理',following:'跟进中',closed:'已结束'};
export function decorateRecord(row:BusinessRecord,kind:string){return {...row,stateLabel:(kind==='bookings'?BOOKING_LABELS:CONSULTATION_LABELS)[row.state],specDisplay:getConsultationSpecDisplay(row.snapshot),displayName:row.request.enrollment?.title || row.snapshot?.name || row.request.team || '其他服务',createdLabel:new Date(row.created_at).toLocaleString()};}
export const message=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试';
const TAB_ROUTES=['/pages/index/index','/pages/instruments/index','/pages/gifts/index','/pages/study/index','/pages/mine/index'];
export const go=(url:string)=>{const path=url.split('?')[0];const fail=()=>wx.showToast({title:'页面打开失败，请重试',icon:'none'});if(TAB_ROUTES.includes(path))wx.switchTab({url:path,fail});else wx.navigateTo({url,fail});};
export function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
