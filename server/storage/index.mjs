import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,lstat,unlink,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
const keyCheck=key=>{if(typeof key!=='string'||!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(key))throw new Error('无效对象Key');return key;};
export class LocalStorage{
 constructor(directory){if(!directory)throw new Error('缺少Local Storage目录');this.directory=resolve(directory);}
 async path(key){await mkdir(this.directory,{recursive:true,mode:0o700});if((await lstat(this.directory)).isSymbolicLink())throw new Error('Storage目录不能是符号链接');return join(await realpath(this.directory),keyCheck(key));}
 async put(key,body){const path=await this.path(key);let created=false;const out=createWriteStream(path,{flags:'wx',mode:0o600});out.once('open',()=>{created=true;});try{await pipeline(body,out);}catch(e){if(created)await unlink(path).catch(()=>{});throw e;}}
 async metadata(key){const path=await this.path(key),s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw new Error('对象不是普通文件');return {size:s.size};}
 async read(key,{start,end}={}){await this.metadata(key);return createReadStream(await this.path(key),{start,end});}
 async delete(key){const path=await this.path(key);try{await this.metadata(key);await unlink(path);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
// Official PG Storage HTTP API, not the classic COS-direct API.
export class CloudBaseStorage{
 constructor({envId,bucket,token,fetchImpl=fetch}){if(!/^[a-zA-Z0-9-]+$/.test(envId||'')||!/^[a-zA-Z0-9_-]+$/.test(bucket||'')||!token)throw new Error('CloudBase Storage配置不完整');this.base=`https://${envId}.api.tcloudbasegateway.com/v1/storages`;this.bucket=bucket;this.token=token;this.fetch=fetchImpl;}
 url(key,action='object'){return `${this.base}/${action}/${encodeURIComponent(this.bucket)}/${encodeURIComponent(keyCheck(key))}`;}
 async request(url,options={}){let r;try{r=await this.fetch(url,{...options,redirect:'error',signal:options.signal||AbortSignal.timeout(120000),headers:{...options.headers,Authorization:'Bearer '+this.token}});}catch{throw new Error('云存储连接失败');}if(!r.ok){await r.body?.cancel();const e=new Error('云存储操作失败');e.storageStatus=r.status;throw e;}return r;}
 async put(key,body,{mime,size}={}){const r=await this.request(this.url(key),{method:'POST',headers:{'Content-Type':mime||'application/octet-stream','Content-Length':String(size),'x-upsert':'false','Cache-Control':'no-store'},body,duplex:'half'});await r.body?.cancel();}
 async metadata(key){const r=await this.request(this.url(key),{method:'HEAD'});const raw=r.headers.get('content-length');const size=raw===null?NaN:Number(raw);if(!Number.isSafeInteger(size)||size<0)throw new Error('云存储大小无效');return {size};}
 async read(key,{start,end}={}){const range=start!==undefined?`bytes=${start}-${end??''}`:null;const r=await this.request(this.url(key),{headers:range?{Range:range}:{}});if(range&&r.status!==206){await r.body?.cancel();throw new Error('云存储未按范围返回');}return Readable.fromWeb(r.body);}
 async delete(key){try{const r=await this.request(this.url(key),{method:'DELETE'});await r.body?.cancel();}catch(e){if(e.storageStatus!==404)throw e;}}
 async signedUrl(key,expiresIn=60){if(!Number.isInteger(expiresIn)||expiresIn<1||expiresIn>300)throw new Error('签名有效期无效');const r=await this.request(this.url(key,'object/sign'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn})});const data=await r.json();const url=new URL(data.fullSignedURL||data.signedURL,this.base);if(url.protocol!=='https:'||url.origin!==new URL(this.base).origin)throw new Error('云存储签名URL无效');return url.href;}
}
export const storageProvider=value=>typeof value==='string'?new LocalStorage(value):value;
