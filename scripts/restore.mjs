import {restoreData} from '../server/backup.mjs';
const [source,target]=process.argv.slice(2);
if(!source || !target)throw new Error('用法：npm run restore -- 备份路径 新目标路径；不覆盖正在使用的数据');
console.log(restoreData(source,target));
