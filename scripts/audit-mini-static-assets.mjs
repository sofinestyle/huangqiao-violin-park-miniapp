import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function auditMiniStaticAssets(root=join(projectRoot,'miniprogram/miniprogram')) {
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
 const files=walk(root),sources=files.filter(p=>/\.(ts|wxml|wxss|json)$/.test(p)),references=[];
 for(const file of sources){
  const source=readFileSync(file,'utf8'),name=relative(root,file);
  const add=(offset,value,kind,extra={})=>references.push({file:name,line:source.slice(0,offset).split('\n').length,value,kind,...extra});
  for(const match of source.matchAll(/(?:src\s*=\s*["']([^"\n]*?)["']|["'](\/assets\/[^"'\n]+)["'])/g)){
   const value=match[1]??match[2];
   if(value.endsWith('.wxml'))continue; // Template imports are code dependencies, not images.
   if(value==='{{heroImage}}'&&name==='pages/study/index.wxml'){
    const code=readFileSync(join(root,'pages/study/index.ts'),'utf8'),path=code.match(/heroImage:\s*['"]([^'"]+)['"]/);
    if(path?.[1].startsWith('/assets/')){add(match.index,value,'A',{targets:[path[1]],exists:existsSync(join(root,path[1])),viaApi:false,reason:'同页固定背景数据绑定'});continue;}
   }
   if(value.startsWith('/assets/')){
    let targets;
    if(value.includes('{{')){
     // The only computed fixed paths are the existing navigation icon variants.
     targets=value.startsWith('/assets/tab-icons/')?files.filter(p=>p.includes('/assets/tab-icons/')&&p.endsWith('.png')).map(p=>'/'+relative(root,p)):[];
    }else targets=[value];
    add(match.index,value,'A',{targets,exists:targets.length>0&&targets.every(p=>existsSync(join(root,p))),viaApi:/mediaUrl\(\s*$/.test(source.slice(Math.max(0,match.index-24),match.index))});
   }else if(value.includes('{{'))add(match.index,value,'B',{reason:'后台业务内容、图库或视频地址绑定；继续由API/media提供'});
   else if(value)add(match.index,value,'D',{reason:'非包内图片引用，需人工核对'});
  }
  for(const match of source.matchAll(/https?:\/\/[^\s"'<>]+|\blocalhost\b|\b127\.0\.0\.1\b|(?:\.\.\/|\/)?images\//g)){
   if(match[0].includes('images/')&&/\/assets\/?$/.test(source.slice(Math.max(0,match.index-8),match.index)))continue;
   add(match.index,match[0],'D',{configuration:['environment-settings.ts','config.ts'].includes(name),reason:['environment-settings.ts','config.ts'].includes(name)?'环境SSOT或本机API安全校验，并非静态资源':'需人工核对外部/本地服务器地址'});
  }
  for(const match of source.matchAll(/url\(\s*([^)]+)\)/g)){
   const embedded=/^["']?data:image\//.test(match[1]);
   add(match.index,match[1],embedded?'A':'D',embedded?{targets:[],exists:true,embedded:true,reason:'内嵌SVG图标，无外部请求'}:{reason:'WXSS背景资源需人工核对'});
  }
 }
 const fixed=[...new Set(references.filter(r=>r.kind==='A').flatMap(r=>r.targets))].sort();
 const assets=files.filter(p=>p.includes('/assets/')&&!p.endsWith('.DS_Store'));
 const unreferenced=assets.filter(p=>!fixed.includes('/'+relative(root,p))).map(p=>({path:'/'+relative(root,p),bytes:statSync(p).size,kind:'C',reason:'源码未引用的历史文件；本轮保留，不擅自删除'}));
 return {sourceFiles:sources.length,references,fixedFiles:fixed.map(p=>({path:p,bytes:existsSync(join(root,p))?statSync(join(root,p)).size:null})),unreferencedAssets:unreferenced,missingFixed:references.filter(r=>r.kind==='A'&&!r.exists),serverDependentFixed:references.filter(r=>r.kind==='A'&&r.viaApi),unresolved:references.filter(r=>r.kind==='D'&&!r.configuration),assetBytes:assets.reduce((n,p)=>n+statSync(p).size,0)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(auditMiniStaticAssets(),null,2));
