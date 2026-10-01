import { randomUUID, createHash } from 'node:crypto';
import { createWriteStream, createReadStream, mkdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { once } from 'node:events';
import { requireValue, permit, text, audit } from './security.mjs';
import { now } from './db.mjs';

export const MAX_UPLOAD=64*1024*1024; // Local validation limit; production budget and format policy remain pending.
export function listMedia(db) {
  const contents=db.prepare('SELECT id,kind,name,state,data FROM content').all().map(c=>({...c,data:JSON.parse(c.data)}));
  return db.prepare('SELECT id,filename,mime,size,sha256,rights,duration,created_at FROM media ORDER BY created_at DESC').all().map(m=>({...m,usedBy:contents.filter(c=>c.data.mediaId===m.id || c.data.images?.includes(`/api/media/${m.id}`) || c.data.specs?.some(s=>s.images?.includes(`/api/media/${m.id}`))).map(({id,kind,name,state})=>({id,kind,name,state}))}));
}
function validHeader(mime,buffer) {
  if(mime==='video/mp4') return buffer.length>12 && buffer.subarray(4,8).toString()==='ftyp';
  if(mime==='video/webm') return buffer.subarray(0,4).toString('hex')==='1a45dfa3';
  if(mime==='image/png') return buffer.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
  if(mime==='image/jpeg') return buffer.subarray(0,3).toString('hex')==='ffd8ff';
  return false;
}
export async function upload(db,actor,request,uploads) {
  permit(actor,'content');
  const mime=request.headers['content-type']?.split(';')[0];
  requireValue(['video/mp4','video/webm','image/png','image/jpeg'].includes(mime),'支持MP4、WebM、PNG、JPG文件',415);
  const rights=text(decodeURIComponent(request.headers['x-media-rights'] || ''),'权属说明',800);
  const filename=text(decodeURIComponent(request.headers['x-file-name'] || ''),'文件名',180);
  const expected=Number(request.headers['content-length']);
  requireValue(Number.isFinite(expected) && expected>0 && expected<=MAX_UPLOAD,'文件为空或超过64MB上传上限',413);
  mkdirSync(uploads,{recursive:true,mode:0o700});
  const key=randomUUID(),storedName=key+({ 'video/mp4':'.mp4','video/webm':'.webm','image/png':'.png','image/jpeg':'.jpg' }[mime]);
  const path=join(uploads,storedName), out=createWriteStream(path,{flags:'wx',mode:0o600});
  const hash=createHash('sha256'); let size=0,header=Buffer.alloc(0), failed;
  out.on('error',e=>{failed=e;});
  try {
    for await(const chunk of request) {
      size+=chunk.length;
      requireValue(size<=MAX_UPLOAD && size<=expected,'文件大小超出声明或上传限制',413);
      if(header.length<32) header=Buffer.concat([header,chunk]).subarray(0,32);
      if(failed) throw failed;
      hash.update(chunk);
      if(!out.write(chunk)) await once(out,'drain');
    }
    out.end(); await once(out,'finish');
    requireValue(size===expected && validHeader(mime,header),'文件格式或内容无效',415);
    const sha=hash.digest('hex');
    db.prepare('INSERT INTO media VALUES (?,?,?,?,?,?,?,?,?)').run(key,filename,mime,size,sha,storedName,rights,null,now());
    audit(db,actor,'media.upload',key,{filename,mime,size,sha256:sha});
    return {id:key,filename,mime,size,rights,url:`/api/media/${key}`,previewUrl:`/api/admin/media/${key}/file`};
  } catch(e) { out.destroy(); try{unlinkSync(path);}catch{} throw e; }
}
export function serveMedia(db,request,response,key,uploads,admin=false) {
  const media=db.prepare('SELECT * FROM media WHERE id=?').get(key);
  requireValue(media,'媒体不存在',404);
  if(!admin) {
    const refs=db.prepare("SELECT data FROM content WHERE state='published'").all();
    requireValue(refs.some(r=>{const d=JSON.parse(r.data);return d.mediaId===key || d.images?.includes(`/api/media/${key}`) || d.specs?.some(s=>s.images?.includes(`/api/media/${key}`));}), '内容已下架或尚未发布',410,'MEDIA_UNAVAILABLE');
  }
  const path=join(uploads,media.stored_name); let size;
  try{size=statSync(path).size;}catch{requireValue(false,'媒体文件不可用',404);}
  const headers={'Content-Type':media.mime,'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':admin?'same-origin':'cross-origin',...(!admin?{'Access-Control-Allow-Origin':'*'}:{})};
  let start=0,end=size-1,status=200;
  if(request.headers.range) {
    const m=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if(!m || (!m[1]&&!m[2])) {response.writeHead(416,{'Content-Range':`bytes */${size}`});response.end();return;}
    if(m[1]) {start=Number(m[1]);end=m[2]?Number(m[2]):end;} else {start=Math.max(0,size-Number(m[2]));}
    if(start>=size || start>end || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {response.writeHead(416,{'Content-Range':`bytes */${size}`});response.end();return;}
    end=Math.min(end,size-1);status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  response.writeHead(status,{...headers,'Content-Length':end-start+1});
  if(request.method==='HEAD'){response.end();return;}
  const stream=createReadStream(path,{start,end});
  // Check publication for every new request; downloaded buffers cannot be revoked.
  stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);
}
