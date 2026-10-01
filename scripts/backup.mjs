import {backupData} from '../server/backup.mjs';
import {resolve} from 'node:path';
const source=process.env.HQ_DATA_DIR || '.local';
const target=process.argv[2] || `backups/${new Date().toISOString().replaceAll(':','-')}`;
const manifest=backupData(source,target);
console.log(`本地备份完成：${resolve(target)}；媒体${manifest.media.length}份。请另行保管备份目录，Git不包含业务数据。`);
