import {openDatabase} from '../server/db.mjs';
import {createAccount} from '../server/security.mjs';
import {randomBytes} from 'node:crypto';
import {resolve,join} from 'node:path';
import {writeFileSync} from 'node:fs';
const [username,role='content']=process.argv.slice(2);
if(!username)throw new Error('用法：npm run account:create -- 账号名称 content|reception|admin');
const dir=resolve(process.env.HQ_DATA_DIR || '.local'),db=openDatabase(join(dir,'huangqiao.sqlite'));
try {
  const password=randomBytes(18).toString('base64url');
  createAccount(db,{username,password,roles:[role]});
  const path=join(dir,`${username}-access.txt`);writeFileSync(path,`本地开发账号\n账号：${username}\n密码：${password}\n请勿转发。\n`,{mode:0o600});
  console.log(`本地账号已建立，访问资料仅保存于 ${path}`);
}finally{db.close();}
