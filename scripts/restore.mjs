import {restoreData} from '../server/backup.mjs';
const [source,uploads]=process.argv.slice(2),connectionString=process.env.RESTORE_DATABASE_URL;
if(!source||!uploads||!connectionString||process.env.RESTORE_CONFIRM!=='new-empty-target')throw new Error('须指定备份路径、新媒体目录、RESTORE_DATABASE_URL及RESTORE_CONFIRM=new-empty-target');
console.log(await restoreData(source,{connectionString,uploads}));
