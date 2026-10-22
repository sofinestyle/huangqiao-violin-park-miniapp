// Builds an approval-bound, transactional marking change. No network or CLI calls.
import {createHash} from 'node:crypto';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const digest=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
export const contentFingerprintSql=alias=>`md5(jsonb_build_object('id',${alias}.id,'kind',${alias}.kind,'name',${alias}.name,'data',${alias}.data,'state',${alias}.state,'sort',${alias}.sort,'version',${alias}.version,'created_at',${alias}.created_at AT TIME ZONE 'UTC','updated_at',${alias}.updated_at AT TIME ZONE 'UTC')::text)`;
export function createPromotionPlan(rows,{envId='huangqiao-staging-d2d1dj1bb4ad90',database='postgres-i56vqlwu',schema='app'}={}){
 if(!Array.isArray(rows)||!rows.length||rows.length>1000||new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('INVALID_PROMOTION_ROWS');
 if(!/^[a-zA-Z0-9_-]+$/.test(database)||!/^([a-z][a-z0-9_]{0,62})$/.test(schema))throw Error('INVALID_PROMOTION_TARGET');
 const content=rows.map(x=>{
  if(typeof x.id!=='string'||!x.id||typeof x.name!=='string'||typeof x.kind!=='string'||x.state!=='published'||x.isTest!==true||!Number.isSafeInteger(x.version)||x.version<1||x.version>=2147483647||!/^[a-f0-9]{32}$/.test(x.rowFingerprint)||!Number.isFinite(Date.parse(x.updatedAt)))throw Error('INVALID_PROMOTION_ROW');
  return {id:x.id,kind:x.kind,name:x.name,state:x.state,before:{isTest:true,version:x.version,updatedAt:x.updatedAt,rowFingerprint:x.rowFingerprint},after:{isTest:false,version:x.version+1,updatedAt:'TRANSACTION_TIMESTAMP'}};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 const plan={format:1,status:'AWAITING_EXPLICIT_DATA_APPROVAL',target:{envId,database,schema},contentCount:content.length,content,audit:{inserts:1,actor:'deployment:approved-inplace-promotion',action:'content.production-promote',object:'approved-content-batch',detailFields:['manifestSha256','contentIds','count','approvalAt']},otherTableUpdates:0,mediaObjectWrites:0,schemaChanges:0,deletes:0};
 return {...plan,sha256:digest(plan)};
}
export function promotionSql(plan,approval){
 const {sha256,...body}=plan;
 if(!/^[a-f0-9]{64}$/.test(sha256)||digest(body)!==sha256)throw Error('PROMOTION_PLAN_CHANGED');
 if(approval?.manifestSha256!==sha256||approval.approvedBy!=='project-owner'||!Number.isFinite(Date.parse(approval.approvedAt)))throw Error('EXPLICIT_DATA_APPROVAL_REQUIRED');
 // Revalidate the structure rather than treating a matching digest as validation.
 const check=createPromotionPlan(plan.content.map(x=>({id:x.id,kind:x.kind,name:x.name,state:x.state,isTest:x.before.isTest,version:x.before.version,updatedAt:x.before.updatedAt,rowFingerprint:x.before.rowFingerprint})),plan.target);
 if(check.sha256!==sha256)throw Error('INVALID_PROMOTION_PLAN');
 const encoded=Buffer.from(JSON.stringify({plan,approval})).toString('hex'),s=plan.target.schema;
 return `DO $hq_promotion$
DECLARE
 payload jsonb := convert_from(decode('${encoded}','hex'),'UTF8')::jsonb;
 item jsonb;
 actual record;
 affected integer;
BEGIN
 IF current_database() <> payload->'plan'->'target'->>'database' THEN RAISE EXCEPTION 'PROMOTION_WRONG_DATABASE'; END IF;
 LOCK TABLE ${s}.content IN SHARE ROW EXCLUSIVE MODE;
 IF (SELECT count(*) FROM ${s}.content) <> (payload->'plan'->>'contentCount')::integer THEN RAISE EXCEPTION 'PROMOTION_CONTENT_SET_CHANGED'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(payload->'plan'->'content') LOOP
  SELECT c.*,${contentFingerprintSql('c')} AS fingerprint INTO actual FROM ${s}.content c WHERE c.id=item->>'id' FOR UPDATE;
  IF NOT FOUND OR actual.fingerprint IS DISTINCT FROM item->'before'->>'rowFingerprint' OR actual.version<>(item->'before'->>'version')::integer OR actual.data->'isTest' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'PROMOTION_CONTENT_CHANGED'; END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(payload->'plan'->'content') LOOP
  UPDATE ${s}.content SET data=jsonb_set(data,'{isTest}','false'::jsonb,false),version=version+1,updated_at=transaction_timestamp() WHERE id=item->>'id';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'PROMOTION_UPDATE_COUNT'; END IF;
 END LOOP;
 INSERT INTO ${s}.audit(actor,action,object,detail,created_at) VALUES('deployment:approved-inplace-promotion','content.production-promote','approved-content-batch',jsonb_build_object('manifestSha256',payload->'plan'->>'sha256','contentIds',(SELECT jsonb_agg(value->>'id') FROM jsonb_array_elements(payload->'plan'->'content')),'count',(payload->'plan'->>'contentCount')::integer,'approvalAt',payload->'approval'->>'approvedAt'),transaction_timestamp());
END $hq_promotion$;`;
}
