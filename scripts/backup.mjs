import {backupData} from '../server/backup.mjs';
import {openDatabase} from '../server/db.mjs';
import {configuration} from '../server/config.mjs';
import {LocalStorage,CloudBaseStorage} from '../server/storage/index.mjs';
const c=configuration(),db=openDatabase(c.database);
try{const manifest=await backupData({db,connectionString:c.database.connectionString,storage:c.storage==='local'?new LocalStorage(c.uploads):new CloudBaseStorage(c.cloudbase)},process.argv[2]||`backups/${Date.now()}`,{previous:process.env.PREVIOUS_BACKUP});console.log(`备份完成，媒体${manifest.media.length}份。请按政策加密并异地保管。`);}finally{await db.close();}
