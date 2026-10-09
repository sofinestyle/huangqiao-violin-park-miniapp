import {resolve} from 'node:path';
const bool=(v,name)=>{if(v===undefined||v==='false'||v==='0')return false;if(v==='true'||v==='1')return true;throw new Error(`${name}须为true/false`);};
export function configuration(env=process.env){
 const environment=env.APP_ENV||'development';if(!['development','staging','production'].includes(environment))throw new Error('APP_ENV无效');
 const development=environment==='development',devAuth=bool(env.LOCAL_DEV_AUTH,'LOCAL_DEV_AUTH'),seed=env.HQ_SEED_MODE||'none';
 if(!['none','development'].includes(seed)||(!development&&(devAuth||seed!=='none')))throw new Error('非开发环境禁止测试身份及测试Seed');
 if(!env.DATABASE_URL)throw new Error('必须配置DATABASE_URL');
 let url;try{url=new URL(env.DATABASE_URL);}catch{throw new Error('数据库连接配置无效');}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('仅支持PostgreSQL');
 if(development&&(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.search||url.hash))throw new Error('Development禁止远程数据库或连接地址覆盖参数');
 if(development&&Object.entries(env).some(([k,v])=>k.startsWith('CLOUDBASE_')&&v))throw new Error('Development禁止云端配置');
 const port=Number(env.PORT||8787);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT无效');
 const adminOrigin=env.ADMIN_ORIGIN||'';
 if(!development){let origin;try{origin=new URL(adminOrigin);}catch{throw new Error('须设置ADMIN_ORIGIN');}if(origin.protocol!=='https:'||origin.origin!==adminOrigin||origin.username||origin.password)throw new Error('ADMIN_ORIGIN须为唯一HTTPS来源');}
 const storage=env.STORAGE_PROVIDER||'local';if(development&&storage!=='local')throw new Error('Development仅允许本地媒体存储');if(!['local','cloudbase'].includes(storage)||(!development&&storage!=='cloudbase'))throw new Error('非开发环境须使用CloudBase私有存储');
 if(storage==='cloudbase'&&(!env.CLOUDBASE_ENV_ID||!env.CLOUDBASE_BUCKET||!env.CLOUDBASE_SERVICE_ROLE_KEY))throw new Error('CloudBase私有存储配置不完整');
 const max=Number(env.PGPOOL_MAX||10);if(!Number.isInteger(max)||max<1||max>50)throw new Error('PGPOOL_MAX须为1—50');
 return {environment,devAuth,seed,port,adminOrigin,storage,uploads:resolve(env.HQ_UPLOAD_DIR||'.local/uploads'),database:{connectionString:env.DATABASE_URL,schema:env.PGSCHEMA||'app',max},cloudbase:{envId:env.CLOUDBASE_ENV_ID,bucket:env.CLOUDBASE_BUCKET,token:env.CLOUDBASE_SERVICE_ROLE_KEY}};
}
