// Only emits guarded content/media/SKU INSERTs. Executes no network/database operation.
import {hash,canonical} from './plan.mjs';
const literal=x=>"'"+String(x).replaceAll("'","''")+"'";
const json=x=>literal(JSON.stringify(x))+'::jsonb';
const columns={content:['id','kind','name','data','state','sort','version','created_at','updated_at'],media:['id','filename','mime','size','sha256','object_key','rights','duration','created_at'],product_skus:['id','product_id','sku_code','option_values','combination_key','reference_price','images','enabled','sort_order','disable_reason','created_at','updated_at']};
const clean=(rows,table)=>rows.map(r=>Object.fromEntries(columns[table].map(k=>[k,r[k]])));
const rowset=(rows,table)=>`jsonb_populate_recordset(NULL::app.${table},${json(clean(rows,table))})`;
const fingerprint=t=>`(SELECT encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') FROM app.${t} t)`;
export function executionSql(plan,{testDatabase}={}){
 if(plan.conflicts.length||plan.content.some(r=>['spot','lesson'].includes(r.kind))||plan.media.some(m=>!m.mime.startsWith('image/'))||plan.target.environment!=='staging'||plan.target.database!=='postgres-i56vqlwu')throw Error('EXECUTION_CONDITIONS_NOT_MET');
 if(testDatabase&&!/^hq_test_[a-z0-9_]+$/.test(testDatabase))throw Error('INVALID_TEST_DATABASE');
 const additions={content:plan.content,media:plan.media.filter(m=>m.action==='MEDIA_TO_UPLOAD'),product_skus:plan.skus};const before={content:plan.expectedExisting.content,media:plan.expectedExisting.media,product_skus:plan.expectedExisting.skus};
 let checks=`IF current_database()<>${literal(testDatabase||plan.target.database)} THEN RAISE EXCEPTION 'TARGET_DATABASE_REJECTED'; END IF;\nPERFORM pg_advisory_xact_lock(hashtextextended('hq:approved-business-migration:v1',0));\nLOCK TABLE app.content,app.media,app.product_skus IN SHARE ROW EXCLUSIVE MODE;\n`;
 const protectedNames=['accounts','sessions','audit','idempotency','migrations','visitors','bookings','changes','consultations','slots'];
 if(plan.protectedBefore.length!==10||protectedNames.some(t=>!plan.protectedBefore.some(p=>p.table_name===t)))throw Error('PROTECTED_SNAPSHOT_INCOMPLETE');
 for(const t of protectedNames){checks+=`LOCK TABLE app.${t} IN SHARE MODE;\nIF ${fingerprint(t)}<>${literal(plan.protectedBefore.find(p=>p.table_name===t).table_hash)} THEN RAISE EXCEPTION 'PROTECTED_BEFORE_CHANGED:${t}'; END IF;\n`;}
 for(const t of Object.keys(columns)){
  checks+=`IF EXISTS(SELECT 1 FROM ${rowset(before[t],t)} e LEFT JOIN app.${t} t ON t.id=e.id WHERE t IS DISTINCT FROM e) THEN RAISE EXCEPTION 'EXISTING_ROWS_CHANGED:${t}'; END IF;\n`;
  checks+=`IF EXISTS(SELECT 1 FROM app.${t} t LEFT JOIN ${rowset([...before[t],...additions[t]],t)} e ON t.id=e.id WHERE e.id IS NULL OR t IS DISTINCT FROM e) THEN RAISE EXCEPTION 'UNEXPECTED_TARGET_ROWS:${t}'; END IF;\n`;
 }
 for(const m of plan.media)checks+=`IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='huangqiao-media' AND name=${literal(m.object_key)} AND (metadata->>'size')::bigint=${Number(m.size)} AND metadata->>'mimetype'=${literal(m.mime)}) THEN RAISE EXCEPTION 'STORAGE_OBJECT_NOT_VERIFIED:${m.id}'; END IF;\n`;
 let inserts='',after='';for(const t of Object.keys(columns)){
  inserts+=`INSERT INTO app.${t}(${columns[t].join(',')}) SELECT ${columns[t].join(',')} FROM ${rowset(additions[t],t)} ON CONFLICT(id) DO NOTHING;\n`;
  after+=`IF EXISTS(SELECT 1 FROM ${rowset([...before[t],...additions[t]],t)} e LEFT JOIN app.${t} t ON t.id=e.id WHERE t IS DISTINCT FROM e) THEN RAISE EXCEPTION 'POSTCHECK_FAILED:${t}'; END IF;\n`;
 }
 for(const t of protectedNames)after+=`IF ${fingerprint(t)}<>${literal(plan.protectedBefore.find(p=>p.table_name===t).table_hash)} THEN RAISE EXCEPTION 'PROTECTED_AFTER_CHANGED:${t}'; END IF;\n`;
 const body=`BEGIN\n${checks}${inserts}${after}END\n`;let tag='$phase2d_'+hash(body).slice(0,24)+'$';while(body.includes(tag))tag=tag.slice(0,-1)+'x$';
 return `-- Phase 2D plan SHA256 ${hash(plan)}; INSERTs only, protected rows unchanged.\n-- All checks and inserts are atomic; identical rerun inserts zero rows.\nDO ${tag}\n${body}${tag};\nSELECT jsonb_build_object('status','COMMITTED','batch',${literal(plan.batch)},'planHash',${literal(hash(plan))},'content',(SELECT count(*) FROM app.content),'media',(SELECT count(*) FROM app.media),'skus',(SELECT count(*) FROM app.product_skus)) AS result;\n`;
}
