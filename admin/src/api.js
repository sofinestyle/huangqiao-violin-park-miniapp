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
function uploadImageOrLocalFile(file,rights,onProgress) {
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST',adminUrl('media'));
    xhr.setRequestHeader('Content-Type',file.type);xhr.setRequestHeader('X-HQ-Action','1');
    xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('X-Media-Rights',encodeURIComponent(rights));
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{let r;try{r=JSON.parse(xhr.responseText);}catch{reject(new Error('上传响应异常'));return;}if(xhr.status===401)window.dispatchEvent(new Event('hq-session-expired'));xhr.status>=200&&xhr.status<300?resolve(r):reject(new Error(r.error || '上传失败'));};
    xhr.onerror=()=>reject(new Error('网络异常，请保留文件并重试'));xhr.timeout=120000;xhr.ontimeout=()=>reject(new Error('上传超时，请重试'));xhr.send(file);
  });
}

export async function uploadFile(file,rights,onProgress) {
  if(!file.type.startsWith('video/'))return uploadImageOrLocalFile(file,rights,onProgress);
  const grant=await post('media/video-uploads',{filename:file.name,mime:file.type,size:file.size,rights});
  if(grant.transport==='local-proxy')return uploadImageOrLocalFile(file,rights,onProgress);
  if(Date.now()>=grant.uploadExpiresAt)throw new Error('上传授权已过期，请重新上传');
  await new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('PUT',grant.uploadUrl);
    xhr.withCredentials=false; // No Admin cookie or server API key goes to Storage.
    xhr.setRequestHeader('Content-Type',file.type);
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(95,Math.round(e.loaded/e.total*95)));};
    xhr.onload=()=>{
      if(xhr.status>=200&&xhr.status<300)return resolve();
      const detail=xhr.status===413?'文件超过上传通道限制':xhr.status===401||xhr.status===403?'上传授权失效，请重新上传':'云存储上传失败，请重试';
      reject(new Error(`${detail}（HTTP ${xhr.status}）`));
    };
    xhr.onerror=()=>reject(new Error('无法连接云存储，请检查网络或跨域配置后重试'));
    xhr.timeout=120000;xhr.ontimeout=()=>reject(new Error('视频上传超时，请重试'));xhr.send(file);
  });
  const path=`media/video-uploads/${grant.id}`;
  let task=await post(path+'/complete',{});
  const deadline=Math.min(grant.expiresAt,Date.now()+180000);
  while(task.state==='verifying'||task.state==='pending'){
    if(Date.now()>deadline)throw new Error('视频仍在服务端校验，请稍后到素材库查看，勿重复上传');
    await new Promise(resolve=>setTimeout(resolve,1000));task=await api(path);
  }
  if(task.state!=='done')throw new Error(task.error||'视频校验失败，请重新上传');
  onProgress(100);return task.media;
}
