import {openDatabase} from '../server/db.mjs';
import {createAccount,audit} from '../server/security.mjs';
import {configuration} from '../server/config.mjs';
const [username,role='admin']=process.argv.slice(2),password=process.env.BOOTSTRAP_PASSWORD;
if(role!=='admin')throw new Error('首个初始化账号必须为admin；其它账号由后台创建');
if(!username||!password)throw new Error('须提供账号名称，并通过服务端BOOTSTRAP_PASSWORD提供密码；不接受命令行密码');
const db=openDatabase(configuration().database);
try{await db.transaction(async()=>{await db.lockKey('hq:accounts');if(await db.maybeOne('SELECT id FROM accounts LIMIT 1'))throw new Error('已有账号，请通过后台管理；Bootstrap仅用于空账号库');const a=await createAccount(db,{username,password,roles:[role]});await audit(db,{id:'bootstrap'},'account.create',a.id,{username,roles:[role]});});console.log('初始化账号已创建。');}finally{await db.close();}
