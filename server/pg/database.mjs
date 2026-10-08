import pg from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const identifier=/^[a-z][a-z0-9_]{0,62}$/;
export const now=()=>new Date().toISOString();
export const decode=v=>v==null?null:typeof v==='string'?JSON.parse(v):v;
const safeNumber=v=>{const n=Number(v);if(!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER)throw new Error('数据库数字超出安全范围');return n;};
const types={getTypeParser(oid,format){if([20,1700].includes(oid))return safeNumber;if(oid===1082)return v=>v;if(oid===1083)return v=>v.slice(0,5);if([1184,1114].includes(oid))return v=>new Date(v).toISOString();return pg.types.getTypeParser(oid,format);}};
export function databaseError(error){
 const mappings={23505:[409,'记录已存在，请检查重复编码','UNIQUE_CONFLICT'],23503:[409,'记录仍有关联或关联对象不存在','REFERENCE_CONFLICT'],23514:[400,'数据不符合约束','INVALID_DATA'],23502:[400,'缺少必要字段','INVALID_DATA'],22:[400,'数据格式无效','INVALID_DATA'],40001:[409,'数据已改变，请重试','TRANSACTION_RETRY'], '40P01':[409,'并发操作冲突，请重试','TRANSACTION_RETRY']};
 const m=mappings[error.code]||(String(error.code).startsWith('22')?mappings[22]:null);
 if(!m)return error;
 const e=new Error(m[1]);[e.status,,e.code]=m;e.pgCode=error.code;e.safe=true;
 if(error.code==='23505'&&error.constraint==='product_skus_code_ci'){e.code='SKU_CODE_CONFLICT';e.message='SKU编码已被使用';}
 return e;
}
export function openPostgres({connectionString=process.env.DATABASE_URL,schema=process.env.PGSCHEMA||'app',max=10,...options}={}){
 if(!identifier.test(schema))throw new Error('无效数据库Schema');
 if(!connectionString&&!process.env.PGHOST)throw new Error('必须配置PostgreSQL连接');
 const pool=new pg.Pool({...options,connectionString,max,types,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,options:`-c search_path=${schema},pg_catalog -c timezone=UTC -c statement_timeout=15000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=20000`});
 pool.on('error',e=>console.error('数据库连接池异常',{code:typeof e.code==='string'?e.code:'CONNECTION_ERROR'}));
 const context=new AsyncLocalStorage();
 const db={pool,schema,
  async query(sql,values=[]){try{return await (context.getStore()||pool).query(sql,values);}catch(e){throw databaseError(e);}},
  async many(sql,values=[]){return (await db.query(sql,values)).rows;},
  async maybeOne(sql,values=[]){const rows=await db.many(sql,values);if(rows.length>1)throw new Error('预期最多一条记录');return rows[0];},
  async one(sql,values=[]){const row=await db.maybeOne(sql,values);if(!row)throw new Error('预期一条记录');return row;},
  async execute(sql,values=[]){const r=await db.query(sql,values);return {changes:r.rowCount};},
  async transaction(fn,{isolation='READ COMMITTED'}={}){
   if(context.getStore())return fn(db);
   if(!['READ COMMITTED','REPEATABLE READ','SERIALIZABLE'].includes(isolation))throw new Error('无效事务隔离级别');
   const client=await pool.connect();let broken=false;
   try{await client.query('BEGIN ISOLATION LEVEL '+isolation);const value=await context.run(client,()=>fn(db));await client.query('COMMIT');return value;}
   catch(e){try{await client.query('ROLLBACK');}catch{broken=true;}throw databaseError(e);}finally{client.release(broken);}
  },
  async lockKey(key){if(!context.getStore())throw new Error('锁必须位于事务内');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);},
  async lockRows(table,ids,mode='UPDATE'){if(!context.getStore())throw new Error('锁必须位于事务内');if(!['content','slots','bookings','consultations','accounts'].includes(table)||!['UPDATE','SHARE'].includes(mode))throw new Error('无效行锁');for(const id of [...new Set(ids.filter(Boolean))].sort())await db.query(`SELECT id FROM ${table} WHERE id=$1 FOR ${mode}`,[id]);},
  close:()=>pool.end()
 };return db;
}
export const transaction=(db,fn,options)=>db.transaction(fn,options);
export async function migrate(db){
 const sql=await readFile(new URL('../../pg/migrations/001_initial_schema.sql',import.meta.url),'utf8');
 const checksum=createHash('sha256').update(sql).digest('hex');
 await db.transaction(async()=>{
  await db.lockKey('hq:migrations:'+db.schema);
  await db.query(`CREATE SCHEMA IF NOT EXISTS ${db.schema}`);
  await db.query('CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const old=await db.maybeOne('SELECT checksum FROM migrations WHERE version=1');
  if(old){if(old.checksum!==checksum)throw new Error('迁移校验和不匹配');return;}
  await db.query(sql);await db.query('INSERT INTO migrations(version,checksum) VALUES(1,$1)',[checksum]);
 });
}
