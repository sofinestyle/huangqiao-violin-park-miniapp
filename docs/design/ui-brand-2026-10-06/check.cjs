const a=require('miniprogram-automator'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});const errors=[];m.on('exception',e=>errors.push(String(e.message||e)));
 const dir='.local/brand-check-2026-10-06';
 const ready=async p=>{for(let i=0;i<80;i++){if(!(await p.data('loading')))break;await p.waitFor(100)}assert.equal(await p.data('error'),'');return p};
 let p=await ready(await m.reLaunch('/pages/brand/index'));await p.waitFor(800);
 const info=await m.systemInfo();
 const report={info,errors,paragraphs:await p.data('introParagraphs'),heroFailed:await p.data('heroFailed'),buildingFailed:await p.data('buildingFailed')};
 const tag=info.windowWidth;
 await m.screenshot({path:`${dir}/hero-${tag}.png`});
 await (await p.$('.brand-next')).tap();await p.waitFor(500);await m.screenshot({path:`${dir}/culture-${tag}.png`});
 await m.callWxMethod('pageScrollTo',{selector:'.brand-poem',duration:0});await p.waitFor(300);await m.screenshot({path:`${dir}/poem-${tag}.png`});
 await m.callWxMethod('pageScrollTo',{selector:'#brand-company',duration:0});await p.waitFor(300);await m.screenshot({path:`${dir}/company-${tag}.png`});
 await m.callWxMethod('pageScrollTo',{scrollTop:99999,duration:0});await p.waitFor(300);await m.screenshot({path:`${dir}/ending-${tag}.png`});
 for(const selector of ['.brand-hero','.brand-culture','.brand-company-section','.brand-building-frame','.brand-company-name']) {const e=await p.$(selector);report[selector]={size:await e.size(),offset:await e.offset()};}
 fs.writeFileSync(`${dir}/result-${tag}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));m.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});
