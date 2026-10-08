// Formal runtime is PostgreSQL only. SQLite archives are not an adapter.
export {openPostgres as openDatabase,openPostgres,transaction,decode,now,migrate} from './pg/database.mjs';
