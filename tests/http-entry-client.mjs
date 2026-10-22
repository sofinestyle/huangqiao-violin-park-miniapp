import http from 'node:http';
// Node's fetch may replace Host. Exercise the actual incoming HTTP authority.
export function entryFetch(url,options={}) {
 return new Promise((resolve,reject)=>{
  const req=http.request(url,{method:options.method||'GET',headers:options.headers},res=>{
   const chunks=[];res.on('data',x=>chunks.push(x));res.on('error',reject);
   res.on('end',()=>{const headers=new Headers();for(const[k,v]of Object.entries(res.headers))for(const value of Array.isArray(v)?v:[v])if(value!==undefined)headers.append(k,value);
    resolve(new Response([204,304].includes(res.statusCode)?null:Buffer.concat(chunks),{status:res.statusCode,headers}));});
  });req.on('error',reject);req.end(options.body);
 });
}
