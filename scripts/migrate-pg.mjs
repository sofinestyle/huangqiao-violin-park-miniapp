import {openDatabase,migrate} from '../server/db.mjs';
import {migrationConfiguration} from '../server/pg/migration-config.mjs';
const db=openDatabase(migrationConfiguration());
try{await migrate(db);console.log('PostgreSQL迁移已核验。');}finally{await db.close();}
