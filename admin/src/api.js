// Static Admin is served on the API origin (or via same-origin reverse proxy).
const configuredBase=import.meta.env.VITE_ADMIN_API_BASE||'/api/admin/';
const base=new URL(configuredBase,window.location.origin);
if(base.origin!==window.location.origin||base.pathname!=='/api/admin/'||base.search||base.hash||base.username||base.password)throw new Error('后台API须为同源/api/admin/');
const adminUrl=path=>base.href+path;
export async function api(path,options={}) {
  let response;try{response=await fetch(adminUrl(path),{...options,credentials:'same-origin',headers:{'Content-Type':'application/json','X-HQ-Action':'1',...options.headers},signal:options.signal || AbortSignal.timeout(10000)});}catch{throw new Error('暂时无法连接服务，请稍后重试');}
  const result=await response.json().catch(()=>{throw new Error('服务响应暂时异常，请保留填写内容并重试');});
  if(!response.ok){if(response.status===401 && path!=='login')window.dispatchEvent(new Event('hq-session-expired'));const error=new Error(result.error || '请求失败，请重试');error.field=result.field;error.code=result.code;throw error;}
  return result;
}
export const post=(path,data)=>api(path,{method:'POST',body:JSON.stringify(data)});
export const put=(path,data)=>api(path,{method:'PUT',body:JSON.stringify(data)});
export function uploadFile(file,rights,onProgress) {
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST',adminUrl('media'));
    xhr.setRequestHeader('Content-Type',file.type);xhr.setRequestHeader('X-HQ-Action','1');
    xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('X-Media-Rights',encodeURIComponent(rights));
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{let r;try{r=JSON.parse(xhr.responseText);}catch{reject(new Error('上传响应异常'));return;}if(xhr.status===401)window.dispatchEvent(new Event('hq-session-expired'));xhr.status>=200&&xhr.status<300?resolve(r):reject(new Error(r.error || '上传失败'));};
    xhr.onerror=()=>reject(new Error('网络异常，请保留文件并重试'));xhr.timeout=120000;xhr.ontimeout=()=>reject(new Error('上传超时，请重试'));xhr.send(file);
  });
}
