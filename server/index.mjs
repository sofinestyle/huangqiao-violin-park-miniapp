import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { existsSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { openDatabase } from './db.mjs';
import { seed } from './seed.mjs';
import { createAccount } from './security.mjs';
import { createHttpServer } from './http.mjs';

if(process.env.APP_ENV && process.env.APP_ENV!=='development')throw new Error('当前交付为本地开发服务，正式云环境须完成验证与配置后另行部署');
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const dataDir=resolve(process.env.HQ_DATA_DIR || join(root,'.local'));
const db=openDatabase(join(dataDir,'huangqiao.sqlite'));seed(db);
if(!db.prepare('SELECT id FROM accounts LIMIT 1').get()) {
  const password=randomBytes(18).toString('base64url');
  createAccount(db,{username:'admin',password,roles:['admin'],canExport:false});
  const access=join(dataDir,'admin-access.txt');
  writeFileSync(access,`本地开发后台初始账号\n账号：admin\n密码：${password}\n此文件仅保存在本机，不纳入Git；请勿转发。\n`,{mode:0o600});chmodSync(access,0o600);
  console.log('初始管理员登录信息已保存至 .local/admin-access.txt');
}
const port=Number(process.env.PORT || 8787);
const {server}=createHttpServer({db,uploads:join(dataDir,'uploads'),root,devAuth:process.env.LOCAL_DEV_AUTH!=='0'});
server.listen(port,'127.0.0.1',()=>console.log(`本地业务服务：http://127.0.0.1:${port}；本地持久数据库已连接`));
const shutdown=()=>server.close(()=>{db.close();process.exit(0);});
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
