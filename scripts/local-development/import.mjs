// Offline allowlisted legacy source reader; never imported by server runtime.
import {DatabaseSync} from 'node:sqlite';import {readFileSync,existsSync,lstatSync,realpathSync,copyFileSync,mkdirSync,writeFileSync} from 'node:fs';import {resolve,join,relative,sep} from 'node:path';import {createHash} from 'node:crypto';
import {assertLocalTarget} from './runtime.mjs';
export const allowedKinds=['site','spot','product','package','lesson'];
export const excludedTables=['accounts','sessions','audit','idempotency','migrations','visitors','bookings','consultations','changes','slots'];
const canonical=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
const digest=v=>createHash('sha256').update(Buffer.isBuffer(v)?v:canonical(v)).digest('hex');
function file(root,relativePath){const abs=resolve(root,relativePath),rel=relative(root,abs);if(!rel||rel.startsWith('..'+sep)||rel.startsWith(sep))throw Error('LOCAL_SOURCE_ESCAPE');let current=root;for(const part of rel.split(sep)){current=join(current,part);if(lstatSync(current).isSymbolicLink())throw Error('LOCAL_SOURCE_SYMLINK');}if(!lstatSync(abs).isFile())throw Error('LOCAL_SOURCE_NOT_FILE');return abs;}
const json=v=>typeof v==='string'?JSON.parse(v):v;
export function inspectLegacy(root){
 root=realpathSync(root);const source=file(root,'.local/huangqiao.sqlite'),sqlite=new DatabaseSync(source,{readOnly:true});let content,skus,media;
 try{sqlite.exec('BEGIN');content=sqlite.prepare('SELECT id,kind,name,data,state,sort,version,created_at,updated_at FROM content ORDER BY sort,id').all().filter(r=>allowedKinds.includes(r.kind)).map(r=>({...r,data:{...json(r.data),isTest:true}}));
 const productIds=new Set(content.filter(r=>r.kind==='product').map(r=>r.id));
 skus=sqlite.prepare('SELECT id,product_id,sku_code,option_values,combination_key,reference_price,images,enabled,sort_order,disable_reason,created_at,updated_at FROM product_skus ORDER BY product_id,sort_order,id').all().filter(r=>productIds.has(r.product_id)).map(r=>({...r,option_values:json(r.option_values),images:json(r.images),enabled:!!r.enabled}));
 media=sqlite.prepare('SELECT id,filename,mime,size,sha256,stored_name,rights,duration,created_at FROM media ORDER BY id').all();sqlite.exec('ROLLBACK');}finally{sqlite.close();}
 if(!content.some(r=>r.kind==='site'&&r.state==='published'))throw Error('LEGACY_HOME_MISSING');
 const versioned=new Set(content.filter(r=>r.kind==='product'&&r.data.variantModelVersion===2).map(r=>r.id));
 if(skus.some(r=>!versioned.has(r.product_id)))throw Error('INCOMPATIBLE_LEGACY_SKUS');
 const ids=new Set(),codes=new Set(),combinations=new Set();
 for(const s of skus){if(ids.has(s.id)||codes.has(s.sku_code.toLowerCase())||combinations.has(s.product_id+':'+s.combination_key)||!/^[A-Za-z0-9_-]{1,64}$/.test(s.sku_code))throw Error('LEGACY_SKU_CONFLICT');ids.add(s.id);codes.add(s.sku_code.toLowerCase());combinations.add(s.product_id+':'+s.combination_key);}
 const refs=new Set();const collect=x=>{if(typeof x==='string'&&/^\/(api\/media\/|assets\/)/.test(x))refs.add(x);else if(Array.isArray(x))x.forEach(collect);else if(x&&typeof x==='object'){if(x.mediaId)refs.add('/api/media/'+x.mediaId);Object.values(x).forEach(collect);}};content.forEach(r=>collect(r.data));skus.forEach(r=>collect(r.images));
 const selected=media.filter(m=>refs.has('/api/media/'+m.id));
 for(const ref of refs){if(ref.startsWith('/api/media/')){if(!selected.some(m=>'/api/media/'+m.id===ref))throw Error('LEGACY_MEDIA_REFERENCE_MISSING');}else file(root,'images/'+ref.slice('/assets/'.length));}
 const bodies=selected.map(m=>{if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(m.stored_name))throw Error('LEGACY_MEDIA_PATH_INVALID');const p=file(root,'.local/uploads/'+m.stored_name),b=readFileSync(p);if(b.length!==m.size||digest(b)!==m.sha256)throw Error('LEGACY_MEDIA_HASH_MISMATCH');const {stored_name,...rest}=m;return {row:{...rest,object_key:stored_name},source:p};});
 const rows={content,media:bodies.map(x=>x.row),product_skus:skus};
 return {rows,bodies,sourceFingerprint:digest(rows),sourceDatabaseHash:digest(readFileSync(source)),staticImages:[...refs].filter(x=>x.startsWith('/assets/')).sort(),excludedTables};
}
export async function importLegacy(db,plan,uploads,{testTarget=false}={}){
 assertLocalTarget({APP_ENV:'development',STORAGE_PROVIDER:'local',DATABASE_URL:db.pool.options.connectionString,PGSCHEMA:db.schema},{test:testTarget});
 const columns={content:['id','kind','name','data','state','sort','version','created_at','updated_at'],media:['id','filename','mime','size','sha256','object_key','rights','duration','created_at'],product_skus:['id','product_id','sku_code','option_values','combination_key','reference_price','images','enabled','sort_order','disable_reason','created_at','updated_at']};
 const jsonColumns=new Set(['data','option_values','images']);let action;
 await db.transaction(async()=>{
  await db.lockKey('local-legacy-development-import');
  const current={};for(const table of Object.keys(columns))current[table]=await db.many('SELECT '+columns[table].join(',')+' FROM '+table);
  const missing={};
  for(const table of Object.keys(columns)){
   const expected=new Map(plan.rows[table].map(row=>[row.id,row]));
   for(const row of current[table]){if(!expected.has(row.id)||canonical(row)!==canonical(expected.get(row.id)))throw Error('LOCAL_TARGET_CONFLICT_NO_OVERWRITE');expected.delete(row.id);}
   missing[table]=[...expected.values()];
  }
  const same=Object.values(missing).every(rows=>!rows.length);
  for(const table of excludedTables.filter(t=>t!=='migrations')){if((await db.one('SELECT count(*) n FROM '+table)).n!==0)throw Error('EXCLUDED_TARGET_NOT_EMPTY:'+table);}
  mkdirSync(uploads,{recursive:true,mode:0o700});
  if(lstatSync(uploads).isSymbolicLink())throw Error('LOCAL_UPLOADS_SYMLINK');
  for(const m of plan.bodies){const target=join(uploads,m.row.object_key);if(existsSync(target)){if(lstatSync(target).isSymbolicLink()||digest(readFileSync(target))!==m.row.sha256)throw Error('LOCAL_MEDIA_TARGET_CONFLICT');}else copyFileSync(m.source,target,1);}
  if(same){action='already-restored';return;}
  for(const table of ['media','content','product_skus']){const names=columns[table];for(const row of missing[table])await db.execute('INSERT INTO '+table+'('+names.join(',')+') VALUES ('+names.map((_,i)=>'$'+(i+1)).join(',')+')',names.map(k=>jsonColumns.has(k)?JSON.stringify(row[k]):row[k]));}
  action=Object.values(current).some(rows=>rows.length)?'resumed':'restored';
 });
 const counts={};for(const table of Object.keys(columns))counts[table]=(await db.one('SELECT count(*) n FROM '+table)).n;
 for(const table of excludedTables.filter(t=>t!=='migrations')){const count=(await db.one('SELECT count(*) n FROM '+table)).n;if(count!==0)throw Error('EXCLUDED_TARGET_NOT_EMPTY:'+table);}
 const result={scope:'LOCAL DEVELOPMENT / TEST ONLY',action,sourceFingerprint:plan.sourceFingerprint,sourceDatabaseHash:plan.sourceDatabaseHash,counts,excludedTables,staticImages:plan.staticImages,media:plan.rows.media.map(m=>({id:m.id,objectKey:m.object_key,sha256:m.sha256,size:m.size})),checkedAt:new Date().toISOString()};
 return result;
}
export function writeImportReport(path,result){writeFileSync(path,JSON.stringify(result,null,2)+'\n',{mode:0o600});}
