const a=require('miniprogram-automator'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});const errors=[];m.on('exception',e=>errors.push(String(e.message||e)));
 await m.reLaunch('/pages/brand/index');let p;
 for(let i=0;i<80;i++){p=await m.currentPage();if(p.path==='pages/brand/index' && (await p.data('loading'))===false && (await p.data('error'))==='' && await p.$('.brand-hero'))break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(p.path,'pages/brand/index');assert.equal(await p.data('error'),'');await p.waitFor(600);
 const info=await m.systemInfo(),dir='docs/design/ui-brand-2026-10-06/revision-2',report={width:info.windowWidth,model:info.model,errors,checks:[]};fs.mkdirSync(dir+'/screenshots',{recursive:true});
 assert.equal((await p.$$('.brand-logo')).length,1);assert.equal((await p.$$('.brand-hero .brand-logo')).length,0);assert.equal(await p.data('heroFailed'),false);
 const bar=await p.$('.brand-bar');report.bar={position:await bar.style('position'),size:await bar.size(),before:await bar.offset()};assert.equal(report.bar.position,'sticky');assert.equal(report.bar.size.height,55);
 report.image=await m.callWxMethod('getImageInfo',{src:'/assets/brand/hero-detail-v2.jpg'});
 await m.screenshot({path:`${dir}/screenshots/hero-${info.windowWidth}.png`});
 await m.callWxMethod('pageScrollTo',{scrollTop:350,duration:0});await p.waitFor(400);report.bar.afterScroll=await bar.offset();assert.ok(Math.abs(report.bar.afterScroll.top)<1);await m.screenshot({path:`${dir}/screenshots/sticky-${info.windowWidth}.png`});
 await m.callWxMethod('pageScrollTo',{scrollTop:0,duration:0});await p.waitFor(300);await(await p.$('.brand-next')).tap();await p.waitFor(600);report.bar.afterArrow=await bar.offset();assert.ok(Math.abs(report.bar.afterArrow.top)<1);report.cultureOffset=await(await p.$('#brand-culture')).offset();assert.ok(Math.abs(report.cultureOffset.top-55)<2);await m.screenshot({path:`${dir}/screenshots/culture-${info.windowWidth}.png`});
 await m.callWxMethod('pageScrollTo',{selector:'#brand-company',duration:0});await p.waitFor(400);report.bar.atCompany=await bar.offset();assert.ok(Math.abs(report.bar.atCompany.top)<1);await m.screenshot({path:`${dir}/screenshots/company-${info.windowWidth}.png`});
 assert.deepEqual(errors,[]);report.checks=['one logo in sticky brand bar','no logo overlay in hero','native image loaded','sticky top = 0 after scroll and in company section','actual down arrow click'];fs.writeFileSync(`${dir}/result-${info.windowWidth}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await m.callWxMethod('pageScrollTo',{scrollTop:0,duration:0});m.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});
