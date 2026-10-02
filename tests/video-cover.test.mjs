import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareVideoCover,durationText} from '../admin/src/video-cover.mjs';
const video={kind:'lesson',type:'video',mediaId:'source-video',images:[]};
test('视频首帧仅在缺少封面时生成，上传使用源视频授权',async()=>{
 const calls=[];const file={name:'first-frame.jpg'};
 const result=await prepareVideoCover(video,{rights:'源视频授权',capture:async url=>{calls.push(url);return file;},upload:async(f,rights)=>{assert.equal(f,file);assert.equal(rights,'源视频授权');return {url:'/api/media/cover'};}});
 assert.deepEqual(calls,['/api/admin/media/source-video/file']);assert.equal(result.url,'/api/media/cover');
 for(const form of [{...video,images:['/assets/manual.jpg']},{...video,type:'article'},{...video,mediaId:''},{...video,kind:'product'}])assert.equal(await prepareVideoCover(form,{capture:()=>assert.fail('不应提取'),upload:()=>assert.fail('不应上传')}),null);
});
test('首帧解码或上传失败不能返回虚假封面',async()=>{
 await assert.rejects(prepareVideoCover(video,{capture:async()=>{throw Error('decode failed')},upload:()=>assert.fail('解码失败后不得上传')}),/decode failed/);
 await assert.rejects(prepareVideoCover(video,{capture:async()=>({}),upload:async()=>{throw Error('upload failed')}}),/upload failed/);
});
test('时长以秒保留两位小数并保留短视频的有效正值',()=>{
 for(const [n,expected] of [[14.943,'14.94'],[60,'60.00'],['2.5','2.50'],[0.004,'0.01'],[null,''],[Infinity,''],[-1,''],['bad','']])assert.equal(durationText(n),expected);
});
