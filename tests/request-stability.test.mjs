import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';

const policySource=readFileSync('miniprogram/miniprogram/lib/request-policy.ts','utf8');
const policyModule=ts.transpileModule(policySource,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const adminSource=readFileSync('admin/src/api.js','utf8').replace('import.meta.env.VITE_ADMIN_API_BASE',"''").replace("'../../miniprogram/miniprogram/lib/request-policy'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(policyModule).toString('base64')));

function mini(outcomes,{method='GET'}={}){
 let now=0,abortCount=0,base='https://staging.invalid';const requests=[],cache=new Map(),timers=new Map(),owner={},storage=new Map();
 const wx={getStorageSync:k=>storage.get(k),removeStorageSync:k=>storage.delete(k),request(options){requests.push(options);const task={abort(){abortCount++;}};const outcome=outcomes.shift();if(outcome){now+=outcome.elapsed||0;outcome.fail?options.fail({errMsg:outcome.fail}):options.success({statusCode:outcome.status||200,data:outcome.data||{ok:true}});}return task;}};
 const fakeMath=Object.create(Math);fakeMath.random=()=>0;
 function load(file){if(cache.has(file))return cache.get(file).exports;if(file.endsWith('/config.ts'))return {getEnvironment:()=>({apiBase:base}),visitorTokenKey:()=> 'staging-token'};
  const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{wx,getCurrentPages:()=>[owner],Date:{now:()=>now},Math:fakeMath,Promise,Map,Set,console,setTimeout:(fn,ms)=>{const key={};timers.set(key,{fn,ms});return key;},clearTimeout:key=>timers.delete(key)})(name=>load(resolve(dirname(file),name+'.ts')),module,module.exports);return module.exports;
 }
 const client=load(resolve('miniprogram/miniprogram/lib/api.ts'));
 return {client,owner,requests,storage,promise:client.api('/api/public/content',{method}),flush(){for(const [key,timer] of [...timers]){timers.delete(key);now+=timer.ms;timer.fn();}},changeTarget(){base='http://127.0.0.1:8787';},aborts:()=>abortCount};
}

test('Native GET: 20s per request, one transient retry, shared 40s deadline',async()=>{
 const h=mini([{fail:'request:fail timeout',elapsed:20000},{status:200}]);h.flush();assert.equal((await h.promise).ok,true);assert.equal(h.requests.length,2);assert.equal(h.requests[0].timeout,20000);assert.equal(h.requests[1].timeout,19500);assert.equal(h.requests[0].url,h.requests[1].url);
 const exhausted=mini([{status:503},{status:503}]);exhausted.flush();await assert.rejects(exhausted.promise,e=>e.status===503);assert.equal(exhausted.requests.length,2);
});
test('Native never retries writes, authentication/validation errors or cancelled/domain failures',async()=>{
 for(const method of ['POST']){const h=mini([{fail:'request:fail timeout'}],{method});h.flush();await assert.rejects(h.promise);assert.equal(h.requests.length,1);assert.equal(h.requests[0].timeout,20000);}
 for(const status of [400,401,403,404,408,409,422,429,500]){const h=mini([{status}]);h.flush();await assert.rejects(h.promise);assert.equal(h.requests.length,1);}
 for(const fail of ['request:fail abort','request:fail url not in domain list','request:fail certificate error','request:fail offline']){const h=mini([{fail}]);h.flush();await assert.rejects(h.promise);assert.equal(h.requests.length,1);}
});
test('Native page/app cancellation and target changes stop both in-flight requests and scheduled retries',async()=>{
 const pending=mini([]);pending.client.cancelReadRequests(pending.owner);await assert.rejects(pending.promise,e=>e.code==='REQUEST_CANCELLED');assert.equal(pending.aborts(),1);pending.requests[0].success({statusCode:200,data:{late:true}});
 for(const mode of ['page','app','environment']){const h=mini([{status:503}]);if(mode==='environment')h.changeTarget();else h.client.cancelReadRequests(mode==='page'?h.owner:undefined);h.flush();await assert.rejects(h.promise,e=>e.code==='REQUEST_CANCELLED');assert.equal(h.requests.length,1);}
});

async function admin(t,responses,{offline=false}={}){
 const names=['window','fetch','navigator','setTimeout','clearTimeout','Date','Math','AbortSignal'];const originals=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 t.after(()=>{for(const [k,v] of Object.entries(originals))v?Object.defineProperty(globalThis,k,v):delete globalThis[k];});
 let now=0;const calls=[],timeouts=[],signals=[],timers=new Map(),events=[];const NativeSignal=globalThis.AbortSignal;const NativeDate=Date;
 const listeners=new Map();globalThis.window={location:{origin:'https://admin.invalid'},dispatchEvent:event=>events.push(event.type),addEventListener:(name,fn)=>listeners.set(name,fn)};
 Object.defineProperty(globalThis,'navigator',{value:{onLine:!offline},configurable:true});
 globalThis.Date=class extends NativeDate{static now(){return now;}};
 const fakeMath=Object.create(Math);fakeMath.random=()=>0;globalThis.Math=fakeMath;
 globalThis.AbortSignal={any:NativeSignal.any.bind(NativeSignal),timeout(ms){timeouts.push(ms);const c=new AbortController();signals.push(c);return c.signal;}};
 globalThis.setTimeout=(fn,ms)=>{const key={};timers.set(key,{fn,ms});return key;};globalThis.clearTimeout=key=>timers.delete(key);
 globalThis.fetch=async(url,options)=>{calls.push({url,options});const outcome=responses.shift();now+=outcome.elapsed||0;if(outcome.abortTimeout){signals.at(-1).abort(new DOMException('Timeout','TimeoutError'));throw new DOMException('Timeout','TimeoutError');}if(outcome.fail)throw new TypeError('Network failure');if(outcome.nonJSON)return new Response('<html>error</html>',{status:outcome.status||200});return Response.json({ok:true,error:'synthetic',code:'SYNTHETIC'},{status:outcome.status||200});};
 const client=await import('data:text/javascript;base64,'+Buffer.from(adminSource).toString('base64')+'#'+Math.random()+calls.length+NativeDate.now());
 return {client,calls,timeouts,events,hide:()=>listeners.get('pagehide')(),async flush(){await new Promise(resolve=>setImmediate(resolve));for(const [key,timer] of [...timers]){timers.delete(key);now+=timer.ms;timer.fn();}await new Promise(resolve=>setImmediate(resolve));}};
}
test('Admin read retry respects 20s attempts, remaining budget and two-attempt limit',async t=>{
 const h=await admin(t,[{abortTimeout:true,elapsed:20000},{status:200}]);const result=h.client.api('content');await h.flush();assert.equal((await result).ok,true);assert.equal(h.calls.length,2);assert.deepEqual(h.timeouts,[20000,19500]);assert.ok(h.calls.every(c=>c.options.credentials==='same-origin'));assert.equal(h.calls[0].url,h.calls[1].url);
});
test('Admin 503 retries once; a second 503 remains failure',async t=>{
 const h=await admin(t,[{status:503},{status:503}]);const result=assert.rejects(h.client.api('content'),/synthetic/);await h.flush();await result;assert.equal(h.calls.length,2);
});
test('Admin writes never retry for POST, PUT, PATCH or DELETE, even with transient status',async t=>{
 const h=await admin(t,[{status:503},{status:503},{status:503},{status:503}]);for(const method of ['POST','PUT','PATCH','DELETE'])await assert.rejects(h.client.api('content',{method,body:'{}'}));assert.equal(h.calls.length,4);assert.deepEqual(h.timeouts,[20000,20000,20000,20000]);
});
test('Admin does not retry permanent errors, non-JSON or explicit offline failure',async t=>{
 const h=await admin(t,[{status:401},{status:404},{status:429},{status:500},{nonJSON:true},{fail:true}],{offline:true});for(let i=0;i<6;i++)await assert.rejects(h.client.api('content'));assert.equal(h.calls.length,6);assert.deepEqual(h.events,['hq-session-expired']);
});
test('Admin caller cancellation interrupts retry delay and cannot issue a second request',async t=>{
 const h=await admin(t,[{status:503}]),c=new AbortController();const result=assert.rejects(h.client.api('content',{signal:c.signal}),/left page/);await Promise.resolve();await Promise.resolve();c.abort(new Error('left page'));await h.flush();await result;assert.equal(h.calls.length,1);
});
test('Admin pagehide cancels pending retry without affecting write policy',async t=>{
 const h=await admin(t,[{status:503}]);const result=assert.rejects(h.client.api('content'),/请求已取消/);await Promise.resolve();await Promise.resolve();h.hide();await h.flush();await result;assert.equal(h.calls.length,1);
});
