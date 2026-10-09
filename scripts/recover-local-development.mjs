import {ensureLocalPostgres,assertLocalTarget,root,settings} from './local-development/runtime.mjs';
import {inspectLegacy,importLegacy,writeImportReport} from './local-development/import.mjs';import {openPostgres} from '../server/pg/database.mjs';import {join} from 'node:path';
const env=await ensureLocalPostgres();const target=assertLocalTarget(env);const plan=inspectLegacy(root),db=openPostgres({connectionString:env.DATABASE_URL,schema:env.PGSCHEMA});
try{const result=await importLegacy(db,plan,env.HQ_UPLOAD_DIR);writeImportReport(join(root,settings.directory,'legacy-import.json'),{...result,target});console.log(JSON.stringify({target,action:result.action,counts:result.counts,scope:result.scope}));}finally{await db.close();}
