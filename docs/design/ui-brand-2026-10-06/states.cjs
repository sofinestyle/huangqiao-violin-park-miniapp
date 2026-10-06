const a=require('miniprogram-automator'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});const errors=[];m.on('exception',e=>errors.push(String(e.message||e)));const report={clicks:[],states:[],errors};
 const ready=async p=>{for(let i=0;i<80;i++){if((await p.data('loading'))===false && (await p.data('error'))==='')break;await p.waitFor(100)}assert.equal(await p.data('error'),'');return p};
 const routed=async expected=>{for(let i=0;i<80;i++){const p=await m.currentPage();if(p.path===expected)return p;await new Promise(r=>setTimeout(r,100));}throw Error('路由未完成:'+expected)};
 let p=await ready(await m.reLaunch('/pages/index/index'));await (await p.$('[data-page="brand"]')).tap();await p.waitFor(600);p=await ready(await m.currentPage());assert.equal(p.path,'pages/brand/index');report.clicks.push('首页品牌入口→品牌介绍');
 await m.navigateBack();await routed('pages/index/index');report.clicks.push('原生返回→首页');
 p=await ready(await m.reLaunch('/pages/brand/index'));await p.waitFor(500);
 const saved=await p.data();
 for(const [name,data,selector] of [['loading',{loading:true,error:''},'.loading'],['error',{loading:false,error:'验证网络失败提示'},'.error'],['empty',{loading:false,error:'',site:null},'.brand-empty']]) {
  await p.setData(data);assert.ok(await p.$(selector));report.states.push(`${name}:渲染注入验证`);
 }
 await p.setData({...saved,error:'验证网络失败提示',loading:false});await (await p.$('.error button')).tap();await ready(p);assert.ok(await p.$('.brand-hero'));report.clicks.push('错误提示重新加载→后台站点资料');
 const backend=await p.data('site');assert.equal('江苏黄桥乐器文化产业园投资发展有限公司，'+(await p.data('introParagraphs')).join(''),backend.intro);report.completeCompanyIntro=true;
 await m.callWxMethod('pageScrollTo',{scrollTop:0,duration:0});await p.waitFor(200);await m.screenshot({path:'.local/brand-check-2026-10-06/final-hero.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync('.local/brand-check-2026-10-06/states.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));m.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});
