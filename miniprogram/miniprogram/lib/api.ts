import { API_BASE, IDENTITY_MODE } from '../config';
export interface Content { id: string; kind: string; name: string; images?: string[]; [key: string]: any }
export interface BusinessRecord { id: string; state: string; snapshot: Content | null; request: Record<string, any>; confirmed?: Record<string, any>; changes?: any[]; [key: string]: any }
export class RequestError extends Error { status: number; constructor(message: string,status: number){super(message);this.status=status;} }
export function api<T>(path: string, options: { method?: 'GET'|'POST'; data?: object; auth?: boolean; key?: string } = {}): Promise<T> {
 const token=wx.getStorageSync('hq-visitor-token');
 return new Promise((resolve,reject)=>wx.request({url:API_BASE+path,method:options.method || 'GET',data:options.data,
 header:{'Content-Type':'application/json',...(options.auth && token?{Authorization:`Bearer ${token}`} : {}),...(options.key?{'Idempotency-Key':options.key}:{})},timeout:10000,
 success(res){if(res.statusCode>=200&&res.statusCode<300)resolve(res.data as T);else{if(res.statusCode===401)wx.removeStorageSync('hq-visitor-token');reject(new RequestError((res.data as {error?:string})?.error || '请求失败，请重试',res.statusCode));}},
 fail(){reject(new RequestError('暂时无法连接本地服务，请确认服务已启动后重试',0));}
 }));
}
export async function ensureIdentity(): Promise<void> {
 if(wx.getStorageSync('hq-visitor-token'))return;
 let result: {token:string};
 if(IDENTITY_MODE==='development')result=await api('/api/auth/development',{method:'POST'});
 else {const code=await new Promise<string>((resolve,reject)=>wx.login({success:r=>resolve(r.code),fail:()=>reject(new Error('微信登录失败，请重试'))}));result=await api('/api/auth/wechat',{method:'POST',data:{code}});}
 wx.setStorageSync('hq-visitor-token',result.token);
}
export const mediaUrl=(url?:string)=>url?API_BASE+url:'';
export function decorate(c:Content):Content {return {...c,images:(c.images || []).map(mediaUrl),specs:(c.specs || []).map((s:any)=>({...s,images:(s.images || []).map(mediaUrl)})),cover:mediaUrl(c.images?.[0]),priceLabel:c.priceMode==='reference'&&typeof c.price==='number'?`参考价 ¥${c.price}`:'咨询报价',videoUrl:c.mediaId?`${API_BASE}/api/media/${c.mediaId}`:''};}
export const newKey=()=>`hq_${Date.now()}_${Math.random().toString(36).slice(2,14)}`;
export const BOOKING_LABELS:Record<string,string>={pending:'待确认',confirmed:'已确认待到访',completed:'已完成',cancelled:'已取消',rejected:'无法接待',no_show:'未到访'};
export const CONSULTATION_LABELS:Record<string,string>={pending:'待处理',following:'跟进中',closed:'已结束'};
export function decorateRecord(row:BusinessRecord,kind:string){return {...row,stateLabel:(kind==='bookings'?BOOKING_LABELS:CONSULTATION_LABELS)[row.state],displayName:row.snapshot?.name || row.request.team || '其他服务',createdLabel:new Date(row.created_at).toLocaleString()};}
export const message=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试';
export const go=(url:string)=>wx.navigateTo({url});
export function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
