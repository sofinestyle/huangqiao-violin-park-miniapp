import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../admin/src/api.js',import.meta.url),'utf8').replace('import.meta.env.VITE_ADMIN_API_BASE',"''");
async function client(t,{local=false,status=200,expired=false,failed=false,poll=false}={}){
 const originals={window:globalThis.window,fetch:globalThis.fetch,XMLHttpRequest:globalThis.XMLHttpRequest};
 t.after(()=>{for(const [k,v]of Object.entries(originals))v===undefined?delete globalThis[k]:globalThis[k]=v;});
 const calls=[],xhrCalls=[];globalThis.window={location:{origin:'https://admin.invalid'},dispatchEvent(){}};
 const media={id:'registered',url:'/api/media/registered'};
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/video-uploads'))return Response.json(local?{transport:'local-proxy'}:{id:'task',uploadUrl:'https://storage.invalid/object/task.mp4?token=synthetic',uploadExpiresAt:Date.now()+(expired?-1:60000),expiresAt:Date.now()+600000});
  return Response.json(poll&&url.endsWith('/complete')?{state:'verifying'}:failed?{state:'failed',error:'远端视频文件内容无效'}:{state:'done',media});
 };
 globalThis.XMLHttpRequest=class{
  constructor(){this.upload={};this.headers={};xhrCalls.push(this);}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(k,v){this.headers[k]=v;}
  send(file){this.file=file;this.status=status;this.responseText=JSON.stringify(media);queueMicrotask(()=>{this.upload.onprogress?.({lengthComputable:true,loaded:file.size,total:file.size});this.onload();});}
 };
 return {...await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')+'#'+Math.random()),calls,xhrCalls,media};
}
const video={type:'video/mp4',name:'synthetic.mp4',size:35_722_048};
test('Admin video bytes bypass business API, no credentials/server headers, server registration controls final result',async t=>{
 const c=await client(t,{poll:true}),progress=[];assert.deepEqual(await c.uploadFile(video,'合成',n=>progress.push(n)),c.media);
 assert.equal(c.xhrCalls.length,1);const x=c.xhrCalls[0];assert.equal(x.method,'PUT');assert.match(x.url,/^https:\/\/storage.invalid\//);assert.equal(x.withCredentials,false);assert.deepEqual(x.headers,{'Content-Type':'video/mp4'});
 assert.equal(JSON.parse(c.calls[0].options.body).size,35_722_048);assert.ok(c.calls.every(c=>c.url.startsWith('https://admin.invalid/api/admin/')));assert.equal(c.calls[1].options.body,'{}');assert.deepEqual(progress,[95,100]);
});
test('Admin image upload retains original endpoint and headers; development video can use local storage',async t=>{
 const c=await client(t,{local:true});await c.uploadFile({...video,type:'image/png'},'',()=>{});assert.equal(c.calls.length,0);assert.equal(c.xhrCalls[0].method,'POST');assert.equal(c.xhrCalls[0].url,'https://admin.invalid/api/admin/media');assert.equal(c.xhrCalls[0].headers['X-HQ-Action'],'1');
 await c.uploadFile(video,'合成',()=>{});assert.equal(c.xhrCalls[1].method,'POST');
});
test('Admin expired grant sends no file and creates no completion request',async t=>{
 const c=await client(t,{expired:true});await assert.rejects(c.uploadFile(video,'合成',()=>{}),/过期/);assert.equal(c.xhrCalls.length,0);assert.equal(c.calls.length,1);
});
test('Admin direct non-JSON 413 displays actual HTTP failure, never registers or retries legacy proxy',async t=>{
 const c=await client(t,{status:413});await assert.rejects(c.uploadFile(video,'合成',()=>{}),/HTTP 413/);assert.equal(c.calls.length,1);assert.equal(c.xhrCalls.length,1);
});
test('Admin failed server verification cannot report upload success',async t=>{
 const c=await client(t,{failed:true}),progress=[];await assert.rejects(c.uploadFile(video,'合成',n=>progress.push(n)),/内容无效/);assert.ok(!progress.includes(100));
});
