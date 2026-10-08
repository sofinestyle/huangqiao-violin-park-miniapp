import {openDatabase,migrate} from '../server/db.mjs';
import {configuration} from '../server/config.mjs';
const db=openDatabase(configuration().database);
try{await migrate(db);console.log('PostgreSQL迁移已核验。');}finally{await db.close();}
