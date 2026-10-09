import {readFileSync,writeFileSync,mkdirSync,existsSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';import {randomBytes} from 'node:crypto';import {parseEnv} from 'node:util';import pg from 'pg';import net from 'node:net';
import {openPostgres,migrate} from '../../server/pg/database.mjs';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const settings=JSON.parse(readFileSync(new URL('./settings.json',import.meta.url),'utf8'));
if(settings.host!=='127.0.0.1'||settings.database!=='hq_development'||settings.user!=='hq_dev'||settings.adminUser!=='hq_local_admin'||settings.schema!=='app'||!Number.isInteger(settings.port)||settings.port<1024||settings.port>65535||settings.apiPort!==8787||settings.directory!=='.local/development-runtime')throw Error('LOCAL_SETTINGS_INVALID');
const dir=resolve(root,settings.directory),credentialsFile=join(dir,'credentials.json');
export function assertLocalTarget(env,{test=false}={}){
 if(env.APP_ENV!=='development'||env.STORAGE_PROVIDER!=='local')throw Error('LOCAL_DEVELOPMENT_ONLY');
 let u;try{u=new URL(env.DATABASE_URL);}catch{throw Error('LOCAL_DATABASE_REQUIRED');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!==settings.host||u.port!==String(settings.port)||u.search||u.hash||(!test&&u.username!==settings.user)||
 !(u.pathname==='/'+settings.database||(test&&/^\/hq_test_[a-z0-9_]+$/.test(u.pathname)))||!(env.PGSCHEMA===settings.schema||(test&&/^test_[a-z0-9_]+$/.test(env.PGSCHEMA))))throw Error('LOCAL_DATABASE_BOUNDARY_REJECTED');
 if(Object.entries(env).some(([k,v])=>k.startsWith('CLOUDBASE_')&&v))throw Error('CLOUD_CONFIGURATION_REJECTED');
 return {host:u.hostname,port:Number(u.port),database:u.pathname.slice(1),user:u.username,schema:env.PGSCHEMA};
}
function incomingGuard(){
 for(const candidate of [process.env,existsSync(join(root,'.env'))?parseEnv(readFileSync(join(root,'.env'),'utf8')):{}]){
  if(candidate.APP_ENV&&candidate.APP_ENV!=='development')throw Error('LOCAL_START_REJECTED_NON_DEVELOPMENT');
  if(candidate.DATABASE_URL){const e={...candidate,APP_ENV:candidate.APP_ENV||'development',STORAGE_PROVIDER:candidate.STORAGE_PROVIDER||'local',PGSCHEMA:candidate.PGSCHEMA||settings.schema};assertLocalTarget(e);}
  if(Object.entries(candidate).some(([k,v])=>k.startsWith('CLOUDBASE_')&&v)||candidate.STORAGE_PROVIDER&&candidate.STORAGE_PROVIDER!=='local')throw Error('LOCAL_START_REJECTED_CLOUD_CONFIG');
 }
}
function credentials(){
 mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);
 if(!existsSync(credentialsFile)){if(existsSync(join(dir,'pgdata','PG_VERSION')))throw Error('LOCAL_CREDENTIALS_MISSING');writeFileSync(credentialsFile,JSON.stringify({adminPassword:randomBytes(32).toString('hex'),password:randomBytes(32).toString('hex')}),{mode:0o600,flag:'wx'});}
 chmodSync(credentialsFile,0o600);const c=JSON.parse(readFileSync(credentialsFile,'utf8'));
 if(!/^[a-f0-9]{64}$/.test(c.password)||!/^[a-f0-9]{64}$/.test(c.adminPassword))throw Error('LOCAL_CREDENTIALS_INVALID');return c;
}
export function runtimeEnvironment(){const c=credentials();const env={APP_ENV:'development',PORT:String(settings.apiPort),DATABASE_URL:`postgresql://${settings.user}:${c.password}@${settings.host}:${settings.port}/${settings.database}`,PGSCHEMA:settings.schema,PGPOOL_MAX:'10',LOCAL_DEV_AUTH:'true',HQ_SEED_MODE:'none',STORAGE_PROVIDER:'local',HQ_UPLOAD_DIR:join(dir,'uploads')};assertLocalTarget(env);return env;}
function postgresBin(){for(const p of ['/opt/homebrew/opt/postgresql@18/bin','/opt/homebrew/opt/postgresql/bin','/usr/local/opt/postgresql@18/bin'])if(existsSync(join(p,'initdb'))&&existsSync(join(p,'pg_ctl')))return p;throw Error('POSTGRESQL_BIN_NOT_FOUND');}
const listening=port=>new Promise(resolve=>{const s=net.connect({host:settings.host,port});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.setTimeout(1500,()=>{s.destroy();resolve(false);});});
export async function ensureLocalPostgres(){
 incomingGuard();const c=credentials(),bin=postgresBin(),data=join(dir,'pgdata');
 if(!existsSync(join(data,'PG_VERSION'))){
  if(await listening(settings.port))throw Error('LOCAL_POSTGRES_PORT_OCCUPIED');
  const pw=join(dir,'init-password');writeFileSync(pw,c.adminPassword+'\n',{mode:0o600});
  try{execFileSync(join(bin,'initdb'),['-D',data,'-U',settings.adminUser,'--pwfile='+pw,'--auth-local=scram-sha-256','--auth-host=scram-sha-256','--encoding=UTF8','--locale=C'],{stdio:['ignore','pipe','pipe']});}finally{const {unlinkSync}=await import('node:fs');unlinkSync(pw);}
 }
 let running=false;try{execFileSync(join(bin,'pg_ctl'),['-D',data,'status'],{stdio:'pipe'});running=true;}catch{}
 if(!running){if(await listening(settings.port))throw Error('LOCAL_POSTGRES_PORT_OCCUPIED');const socket=join(dir,'socket');mkdirSync(socket,{recursive:true,mode:0o700});execFileSync(join(bin,'pg_ctl'),['-D',data,'-l',join(dir,'postgres.log'),'-o',`-h ${settings.host} -p ${settings.port} -k ${socket}`,'-w','start'],{stdio:['ignore','pipe','pipe']});}
 const admin=new pg.Client({host:settings.host,port:settings.port,database:'postgres',user:settings.adminUser,password:c.adminPassword,connectionTimeoutMillis:3000});await admin.connect();
 try{
  const role=(await admin.query('SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1',[settings.user])).rows[0];
  if(!role)await admin.query(`CREATE ROLE ${settings.user} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${c.password}'`);
  else if(role.rolsuper||role.rolcreatedb||role.rolcreaterole||role.rolreplication||role.rolbypassrls)throw Error('LOCAL_RUNTIME_ROLE_EXCESS_PRIVILEGES');
  if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[settings.database])).rowCount)await admin.query(`CREATE DATABASE ${settings.database} OWNER ${settings.adminUser}`);
 }finally{await admin.end();}
 const connectionString=`postgresql://${settings.adminUser}:${c.adminPassword}@${settings.host}:${settings.port}/${settings.database}`;
 const db=openPostgres({connectionString,schema:settings.schema,max:1});
 try{await migrate(db);await db.query(`GRANT CONNECT ON DATABASE ${settings.database} TO ${settings.user}; GRANT USAGE ON SCHEMA ${settings.schema} TO ${settings.user}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA ${settings.schema} TO ${settings.user}; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA ${settings.schema} TO ${settings.user}; REVOKE INSERT,UPDATE,DELETE ON migrations FROM ${settings.user}`);}finally{await db.close();}
 const env=runtimeEnvironment(),envFile=join(root,'.env');
 if(!existsSync(envFile))writeFileSync(envFile,Object.entries(env).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600,flag:'wx'});
 assertLocalTarget(env);return env;
}
export function localTestAdmin(){const c=credentials();return {host:settings.host,port:settings.port,user:settings.adminUser,password:c.adminPassword,database:'postgres'};}
