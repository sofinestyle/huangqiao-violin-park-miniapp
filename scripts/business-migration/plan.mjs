// Phase 2D: deterministic, offline plan from current PostgreSQL snapshots. No writes to databases/storage.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {basename,join} from 'node:path';
import {combinationKey,combinations} from '../../shared/sku-model.mjs';
export const canonical=x=>JSON.stringify(sort(x));
function sort(x){return Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;}
export const hash=x=>createHash('sha256').update(Buffer.isBuffer(x)||typeof x==='string'?x:canonical(x)).digest('hex');
// UUID v4 syntax is required by the current SKU API. Hash-derived bytes are stable per target and source identity.
export function stableId(key){const b=Buffer.from(hash('hq:phase2d:staging:v1:'+key).slice(0,32),'hex');b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export const moduleOf=r=>r.kind==='product'?(r.data.category==='gift'?'cultural':'instrument'):({package:'study',lesson:'teaching'}[r.kind]||r.kind);
export function refs(x){if(typeof x==='string')return /^\/(assets\/|api\/media\/)/.test(x)?[x]:[];if(Array.isArray(x))return x.flatMap(refs);if(x&&typeof x==='object')return [...(x.mediaId?['/api/media/'+x.mediaId]:[]),...Object.values(x).flatMap(refs)];return [];}
function requireThat(ok,message){if(!ok)throw Error(message);}
const normal=r=>({...r,created_at:new Date(r.created_at).toISOString(),updated_at:r.updated_at?new Date(r.updated_at).toISOString():undefined});
export function buildPlan(source,target,evidence,guide,{root,uploadDir,systemAssetMappings={}}){
 requireThat(source.identity.host==='127.0.0.1/32'&&source.identity.port===55433&&source.identity.database==='hq_development'&&source.identity.schema==='app','SOURCE_NOT_LOCAL_DEVELOPMENT');
 requireThat(target.database==='postgres-i56vqlwu'&&evidence.database===target.database,'TARGET_NOT_APPROVED_STAGING');
 requireThat(Object.keys(systemAssetMappings).every(k=>k==='/assets/yorray-logo.png'&&/^\/assets\/yorray-logo-[A-Za-z0-9_-]+\.png$/.test(systemAssetMappings[k])),'INVALID_SYSTEM_ASSET_MAPPING');
 const plan={version:1,batch:'approved-business-staging-v1',source:source.identity,target:{environment:'staging',database:target.database,schema:'app',bucket:'huangqiao-media',cloudbaseEnv:'huangqiao-staging-d2d1dj1bb4ad90'},sourceHash:hash({content:source.content,media:source.media,skus:source.skus}),approved:[],alreadyMigrated:[],skippedVideo:[],manualReview:[],conflicts:[],media:[],content:[],skus:[],specMappings:[],systemAssets:[...new Set(['/assets/yorray-logo.png',...Object.values(systemAssetMappings)])],systemAssetMappings};
 const urlMap=new Map(),byHash=new Map(target.media.map(m=>[m.sha256,m])),objects=new Map(evidence.objects.map(o=>[o.name,o])),skuCodes=new Set(target.skus.map(s=>s.sku_code.toLowerCase()));
 for(const g of guide.records){const src=source.content.find(r=>r.id===g.source.id),dst=target.content.find(r=>r.id===g.targetId);const map=new Map(guide.media.map(m=>[m.sourceUrl,'/api/media/'+m.targetId]));const replace=x=>typeof x==='string'?(map.get(x)||x):Array.isArray(x)?x.map(replace):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,replace(v)])):x;
  requireThat(src&&dst&&src.name===dst.name&&src.state===dst.state&&src.sort===dst.sort&&canonical(replace(src.data))===canonical(dst.data),'GUIDE_CONTENT_CHANGED:'+g.source.id);
  plan.alreadyMigrated.push({module:'spot',sourceId:src.id,targetId:dst.id,name:dst.name,status:'ALREADY_MIGRATED',targetHash:hash(normal(dst))});
 }
 for(const g of guide.media){const m=target.media.find(m=>m.id===g.targetId),o=objects.get(g.objectKey);requireThat(m&&m.sha256===g.sha256&&Number(m.size)===g.size&&m.mime===g.mime&&m.object_key===g.objectKey&&o&&Number(o.metadata.size)===g.size&&o.metadata.mimetype===g.mime,'GUIDE_MEDIA_CHANGED:'+g.targetId);urlMap.set(g.sourceUrl,'/api/media/'+g.targetId);}
 const selected=[];
 for(const r of source.content){const module=moduleOf(r);if(module==='teaching'){plan.skippedVideo.push({sourceId:r.id,name:r.name,state:r.state,type:r.data.type,mediaId:r.data.mediaId||null,status:'SKIPPED_VIDEO'});continue;}if(module==='spot')continue;
  if(r.id==='package-1'){plan.manualReview.push({module,sourceId:r.id,name:r.name,status:'MANUAL_REVIEW',reason:'同名套餐业务字段冲突；负责人决定两个版本保留，Development新名称和编码尚待另行明确',targetId:'22c5b91a-16b3-4862-8c01-e7bb1a76c82c'});continue;}
  if(r.kind==='product'&&r.data.variantModelVersion!==2){const specs=r.data.specs||[],single=module==='cultural'&&specs.length===1&&specs[0].name==='默认规格';const sizes=module==='instrument'&&specs.length>0&&specs.every(s=>/^(1\/8|1\/4|1\/2|3\/4|4\/4)$/.test(s.name));
   if((!single&&!sizes)||specs.some(s=>s.description?.trim())||new Set(specs.map(s=>s.name)).size!==specs.length){plan.manualReview.push({module,sourceId:r.id,name:r.name,status:'MANUAL_REVIEW',reason:'旧规格附加说明无法无损映射到当前SKU字段，或维度/重复规格无法可靠判定',specs});continue;}}
  const duplicate=target.content.find(t=>t.kind===r.kind&&(t.name===r.name||(r.data.code&&t.data.code===r.data.code)))||(module==='site'&&target.content.find(t=>t.kind==='site'));
  if(duplicate){plan.conflicts.push({sourceId:r.id,name:r.name,targetId:duplicate.id,reason:'目标已有同名/编码/单一site'});continue;}
  const video=refs([r.data,source.skus.filter(s=>s.product_id===r.id)]).find(u=>source.media.find(m=>u==='/api/media/'+m.id)?.mime.startsWith('video/'));
  if(video){plan.conflicts.push({sourceId:r.id,name:r.name,reason:'非教学内容引用视频',video});continue;}selected.push(r);
 }
 function mapMedia(url){if(plan.systemAssets.includes(url)){const mapped=systemAssetMappings[url]||url;urlMap.set(url,mapped);return mapped;}if(urlMap.has(url)){const id=urlMap.get(url).slice(11),m=target.media.find(m=>m.id===id);if(m&&!plan.media.some(x=>x.id===id))plan.media.push({...m,action:'MEDIA_REUSE',sourceUrls:[url]});return urlMap.get(url);}
  const original=url.startsWith('/api/media/')?source.media.find(m=>m.id===url.slice(11)):null;requireThat(original||/^\/assets\/[a-zA-Z0-9_.-]+\.(png|jpg)$/.test(url),'UNKNOWN_SOURCE_MEDIA:'+url);
  const path=original?join(root,'.local/development-runtime/uploads',original.object_key):join(root,'images',url.slice(8));const bytes=readFileSync(path),sha256=hash(bytes),mime=original?.mime||(path.endsWith('.png')?'image/png':'image/jpeg');
  requireThat(mime.startsWith('image/')&&(mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216),'NOT_APPROVED_IMAGE:'+url);
  if(original)requireThat(original.sha256===sha256&&Number(original.size)===bytes.length,'SOURCE_FILE_CHANGED:'+url);
  let m=byHash.get(sha256),entry=plan.media.find(x=>x.sha256===sha256);
  if(!entry){if(m){requireThat(m.mime===mime&&Number(m.size)===bytes.length&&objects.has(m.object_key),'EXISTING_MEDIA_CONFLICT:'+sha256);entry={...m,action:'MEDIA_REUSE',sourceUrls:[]};}
   else{const id=stableId('media:'+sha256),object_key=id+(mime==='image/png'?'.png':'.jpg');requireThat(!objects.has(object_key)&&!target.media.some(m=>m.id===id),'STORAGE_OBJECT_CONFLICT:'+object_key);entry={id,filename:original?.filename||basename(path),mime,size:bytes.length,sha256,object_key,rights:original?.rights||'',duration:null,created_at:original?.created_at||'2026-10-09T11:40:00.000Z',action:'MEDIA_TO_UPLOAD',sourceUrls:[],sourcePath:path,uploadPath:join(uploadDir,object_key)};}
   plan.media.push(entry);byHash.set(sha256,entry);}
  entry.sourceUrls.push(url);urlMap.set(url,'/api/media/'+entry.id);return '/api/media/'+entry.id;
 }
 const replace=x=>typeof x==='string'&&/^\/(assets\/|api\/media\/)/.test(x)?mapMedia(x):Array.isArray(x)?x.map(replace):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='mediaId'&&v?mapMedia('/api/media/'+v).slice(11):replace(v)])):x;
 // The existing detail API calls /api/public/content/site; preserve this singleton identity.
 for(const r of selected){const id=r.kind==='site'?'site':stableId('content:'+r.id),data=structuredClone(r.data);let skus=[];const mapping={sourceId:r.id,targetId:id,name:r.name,module:moduleOf(r),status:'APPROVED'};
  if(r.kind==='product'){
   if(data.variantModelVersion===2){const idMap=new Map();for(const o of data.options){idMap.set(o.id,stableId('option:'+r.id+':'+o.id));for(const v of o.values)idMap.set(v.id,stableId('value:'+r.id+':'+v.id));}data.options=data.options.map(o=>({...o,id:idMap.get(o.id),values:o.values.map(v=>({...v,id:idMap.get(v.id)}))}));skus=source.skus.filter(s=>s.product_id===r.id).map(s=>({...normal(s),id:stableId('sku:'+r.id+':'+s.id),product_id:id,option_values:Object.fromEntries(Object.entries(s.option_values).map(([o,v])=>[idMap.get(o),idMap.get(v)]))}));mapping.conversion='CURRENT_SKU_2';}
   else{const specs=data.specs;delete data.specs;data.variantModelVersion=2;data.variantMode=moduleOf(r)==='cultural'?'simple':'options';const optionId=stableId('option:'+r.id+':size');data.options=data.variantMode==='simple'?[]:[{id:optionId,name:'尺寸',sort:0,enabled:true,values:specs.map((s,i)=>({id:stableId('value:'+r.id+':'+s.name),label:s.name,sort:i,enabled:true}))}];
    skus=specs.map((s,i)=>({id:stableId('sku:'+r.id+':'+s.name),product_id:id,sku_code:'MIG-'+hash(r.id+':'+s.name).slice(0,24),option_values:data.variantMode==='simple'?{}:{[optionId]:data.options[0].values[i].id},reference_price:null,images:s.images||[],enabled:true,sort_order:i,disable_reason:'',created_at:r.created_at,updated_at:r.updated_at}));
    plan.specMappings.push({sourceId:r.id,targetId:id,name:r.name,dimension:data.variantMode==='simple'?'单规格（默认规格）':'尺寸',values:specs.map((s,i)=>({oldSpec:s,optionId:data.variantMode==='simple'?null:optionId,valueId:data.options[0]?.values[i].id||null,skuId:skus[i].id,skuCode:skus[i].sku_code,price:'继承产品参考价；咨询报价产品不新增价格',imageRule:skus[i].images.length?'保留规格独立图片及顺序':'继承产品图库及顺序'}))});mapping.conversion=data.variantMode==='simple'?'DEFAULT_SPEC_TO_SIMPLE_SKU':'EXPLICIT_SIZE_TO_OPTION_VALUE_SKU';}
   const combos=combinations(data.variantMode,data.options);requireThat(combos&&combos.length>0&&combos.length<=50,'SKU_COMBINATION_LIMIT:'+r.id);requireThat(skus.length===combos.length,'SKU_COUNT_MISMATCH:'+r.id);
   for(const s of skus){requireThat(!skuCodes.has(s.sku_code.toLowerCase()),'SKU_CODE_CONFLICT:'+s.sku_code);skuCodes.add(s.sku_code.toLowerCase());s.combination_key=combinationKey(s.option_values);s.images=replace(s.images);requireThat(!Object.keys(s.option_values).includes('undefined')&&!Object.values(s.option_values).includes(undefined),'SKU_MAPPING_INCOMPLETE');}
  }
  const row={...normal(r),id,data:replace(data)};requireThat(row.data.isTest===true,'SOURCE_NOT_MARKED_TEST:'+r.id);plan.content.push(row);plan.skus.push(...skus);plan.approved.push(mapping);
 }
 plan.skippedVideoFiles=source.media.filter(m=>m.mime.startsWith('video/')).map(m=>({sourceId:m.id,filename:m.filename,sha256:m.sha256,size:m.size,status:'SKIPPED_VIDEO'}));
 plan.urlMappings=Object.fromEntries(urlMap);plan.guideMedia=guide.media.map(g=>({id:g.targetId,sha256:g.sha256,object_key:g.objectKey,status:'ALREADY_MIGRATED'}));
 plan.expectedExisting={content:target.content.map(normal),media:target.media.map(normal),skus:target.skus.map(normal)};plan.protectedBefore=evidence.protected;
 plan.summary={APPROVED:plan.approved.length,ALREADY_MIGRATED:plan.alreadyMigrated.length,SKIPPED_VIDEO:plan.skippedVideo.length,MANUAL_REVIEW:plan.manualReview.length,CONFLICT:plan.conflicts.length,MEDIA_TO_UPLOAD:plan.media.filter(m=>m.action==='MEDIA_TO_UPLOAD').length,MEDIA_REUSE:plan.media.filter(m=>m.action==='MEDIA_REUSE').length,SKIPPED_VIDEO_FILES:plan.skippedVideoFiles.length,SKU:plan.skus.length};
 requireThat(!refs([plan.content,plan.skus]).some(u=>!plan.systemAssets.includes(u)&&!u.startsWith('/api/media/')),'UNMAPPED_BUSINESS_MEDIA');return plan;
}
