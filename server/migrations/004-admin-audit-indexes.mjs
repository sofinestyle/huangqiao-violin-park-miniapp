// ABI-06: additive indexes only; existing rows and historical migrations stay intact.
const definitions = [
  ['audit_created_at_id', 'created_at DESC,id DESC'],
  ['audit_actor_created_at_id', 'actor,created_at DESC,id DESC'],
  ['audit_action_created_at_id', 'action,created_at DESC,id DESC'],
];
export function migrateAuditIndexes(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT 1 FROM migrations WHERE version=4').get()) {
      for (const [name, columns] of definitions) db.exec(`CREATE INDEX ${name} ON audit(${columns})`);
      db.prepare('INSERT INTO migrations VALUES (4,?)').run(new Date().toISOString());
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function rollbackAuditIndexes(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [name] of definitions) db.exec(`DROP INDEX IF EXISTS ${name}`);
    db.prepare('DELETE FROM migrations WHERE version=4').run();
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
