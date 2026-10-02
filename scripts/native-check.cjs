// Local integration only. Creates clearly marked virtual records, never uploads/releases code.
const automator=require('miniprogram-automator');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mode=process.argv[2] || 'views';
const resultsPath='/tmp/huangqiao-native-check.json';
const lessonId=process.env.HQ_TEST_LESSON_ID;
(async()=>{
 const m=await automator.launch({projectPath:path.resolve('miniprogram'),trustProject:true,timeout:45000});
 if(!m)throw Error('微信自动化连接失败');
 const exceptions=[];m.on('exception',e=>exceptions.push(String(e.message || e)));
 const results={environment:'WeChat developer tools simulator / local API',mode,checkedAt:new Date().toISOString(),pages:[],exceptions};
 const ready=async p=>{for(let i=0;i<50;i++){if(!(await p.data('loading')))break;await p.waitFor(100);}assert.equal(await p.data('error'),'');return p;};
 const open=async route=>{console.log('CHECK',route);return ready(await m.reLaunch(route));};
 const button=async(p,label)=>{for(const b of await p.$$('button')){if((await b.text()).trim()===label)return b;}throw Error('未找到按钮：'+label);};
 const routed=async expected=>{for(let i=0;i<30;i++){const p=await m.currentPage();if(p?.path===expected)return p;await p.waitFor(100);}throw Error('页面跳转未完成：'+expected);};
 try{
  if(mode==='views' || mode==='create') {
   let p=await open('/pages/index/index');assert.equal((await p.data('stats')).packages,5);await m.screenshot({path:'/tmp/huangqiao-native-home.png'});
   for(const route of ['/pages/instruments/index','/pages/gifts/index','/pages/study/index','/pages/mine/index','/pages/product/index?id=violin-L201','/pages/package/index?id=package-1','/pages/booking/index?id=package-1','/pages/booking/index?group=1','/pages/consult/index','/pages/teaching/index','/pages/tour/index','/pages/about/index','/pages/records/index']) {await open(route);results.pages.push(route);}
   p=await open('/pages/product/index?id=violin-L201');await p.callMethod('select',{currentTarget:{dataset:{index:1}}});await p.callMethod('consult');p=await routed('pages/consult/index');assert.equal(p.path,'pages/consult/index');assert.ok(await p.data('spec'));results.specCarried=true;
   if(lessonId){p=await open('/pages/lesson/index?id='+lessonId);await p.waitFor(500);const v=await p.$('video');console.log('VIDEO_COMPONENT',!!v);await m.screenshot({path:'/tmp/huangqiao-native-video.png'});assert.ok(v);await v.callContextMethod('play');await p.waitFor(2300);assert.equal(await p.data('playbackError'),false);assert.ok((await p.data('playTime'))>0 || (await p.data('ended')));results.video={played:true,time:await p.data('playTime'),ended:await p.data('ended'),visitorSessionBefore:!!(await m.callWxMethod('getStorageSync','hq-visitor-token'))};await m.screenshot({path:'/tmp/huangqiao-native-video.png'});console.log('VIDEO_PLAYBACK',JSON.stringify(results.video));}
  }
  if(mode==='create' || mode==='business') {
   let p,r; if(mode==='business'){r=await open('/pages/record/index?kind=bookings&id='+process.env.HQ_TEST_BOOKING_ID);results.bookingId=await r.data('id');assert.equal((await r.data('row')).state,'pending');} else { p=await open('/pages/booking/index?id=package-1');await p.callMethod('date',{detail:{value:'2099-10-20'}});
   for(const [key,value] of Object.entries({adults:'1',children:'1',contactName:'虚拟测试访客（原生联调）',phone:'13800000000',note:'仅机制验证，不用于真实接待'})){const e=await p.$(`[data-key="${key}"]`);assert.ok(e);await e.input(value);}
   await p.callMethod('consent',{detail:{value:['agree']}});const submit=await button(p,'提交预约申请');await submit.tap();r=await routed('pages/record/index');assert.equal(r.path,'pages/record/index');await ready(r);results.bookingId=await r.data('id');assert.equal((await r.data('row')).state,'pending');}
   p=await open('/pages/consult/index?id=violin-L201&spec=4%2F4');for(const [key,value] of Object.entries({contactName:'虚拟咨询访客（原生联调）',phone:'13800000000',message:'测试了解4/4规格，仅机制验证'})){await (await p.$(`[data-key="${key}"]`)).input(value);}await p.callMethod('consent',{detail:{value:['agree']}});await (await button(p,'提交咨询')).tap();r=await routed('pages/record/index');assert.equal(r.path,'pages/record/index');await ready(r);results.consultationId=await r.data('id');assert.equal((await r.data('row')).state,'pending');await m.screenshot({path:'/tmp/huangqiao-native-consultation.png'});
  }
  if(mode==='verify') {
   const prev=JSON.parse(fs.readFileSync(resultsPath,'utf8'));
   for(const [kind,id,expected] of [['bookings',prev.bookingId,'completed'],['consultations',prev.consultationId,'closed']]){const p=await open(`/pages/record/index?kind=${kind}&id=${id}`);assert.equal((await p.data('row')).state,expected);results[kind]=expected;await m.screenshot({path:`/tmp/huangqiao-native-${kind}-result.png`});}
   await open('/pages/records/index');results.ownBookingsListed=true;
  }
  assert.deepEqual(exceptions,[]);fs.writeFileSync(mode==='verify'?'/tmp/huangqiao-native-result.json':resultsPath,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{m.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
