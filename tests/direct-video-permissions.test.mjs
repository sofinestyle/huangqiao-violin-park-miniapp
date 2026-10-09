import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID, createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {openDatabase, testConnection} from './pg-test-db.mjs';
import {openPostgres} from '../server/pg/database.mjs';
import {createAccount} from '../server/security.mjs';
import {authorizeVideo, completeVideo, getVideoTask, videoUploadWorker} from '../server/video-uploads.mjs';

// Run the documented huangqiao_app ACL as a real non-owner LOGIN role. Random
// identifiers avoid touching any existing role; testConnection rejects cloud DBs.
async function fixture(t) {
  const owner = await openDatabase(), role = 'hq_app_' + randomUUID().replaceAll('-', '');
  const url = new URL(testConnection()), database = url.pathname.slice(1);
  const doc = await readFile(new URL('../docs/deployment/phase-2a/MIGRATION_RUNTIME_FIX.md', import.meta.url), 'utf8');
  const grants = doc.match(/<!-- runtime-grants:start -->\s*```sql\n([\s\S]*?)```\s*<!-- runtime-grants:end -->/)?.[1];
  assert.ok(grants, 'Production/Staging grant block must remain testable');
  await owner.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
  let db;
  t.after(async () => {
    try { if (db) await db.close(); }
    finally { await owner.query(`DROP OWNED BY ${role}; DROP ROLE ${role}`); }
  });
  const sql = grants.replaceAll('"postgres-i56vqlwu"', '"' + database + '"')
    .replace(/\bapp\b/g, owner.schema).replaceAll('huangqiao_app', role);
  await owner.query(sql);
  url.username = role; url.password = '';
  db = openPostgres({connectionString: url.toString(), schema: owner.schema, max: 2});
  assert.equal((await db.one('SELECT current_user AS role')).role, role);
  const actor = await createAccount(db, {username: 'synthetic', password: randomUUID(), roles: ['content']});
  const body = Buffer.concat([Buffer.from('000000186674797069736f6d', 'hex'), Buffer.alloc(1024)]);
  const input = {filename: 'synthetic.mp4', mime: 'video/mp4', size: body.length, rights: '隔离合成资料'};
  const objects = new Map(); let time = Date.now();
  const storage = {
    async signVideoUpload(key) { return {url: 'https://isolated.invalid/' + key, expiresAt: time + 60000}; },
    async videoMetadata(key) { const b = objects.get(key); if (!b) throw Error('missing'); return {size: b.length, mime: input.mime}; },
    async read(key) { return Readable.from([objects.get(key)]); },
    async delete(key) { objects.delete(key); }
  };
  const clock = () => time, errors = [];
  return {owner, db, role, actor, body, objects, input, storage, clock, errors,
    worker: videoUploadWorker(db, storage, {clock, onError: () => errors.push('worker failed')}),
    grant: () => authorizeVideo(db, actor, storage, input, clock),
    complete: id => completeVideo(db, actor, id, {}, clock),
    status: id => getVideoTask(db, actor, id, clock),
    advance: ms => { time += ms; }};
}

test('Documented runtime ACL permits only response UPDATE, with no elevated role or destructive task privileges', async t => {
  const f = await fixture(t), relation = f.db.schema + '.idempotency';
  const acl = await f.db.one(`SELECT has_table_privilege(current_user,$1,'SELECT') AS sel,
    has_table_privilege(current_user,$1,'INSERT') AS ins,
    has_table_privilege(current_user,$1,'UPDATE') AS upd,
    has_column_privilege(current_user,$1,'response','UPDATE') AS response`, [relation]);
  assert.deepEqual(acl, {sel: true, ins: true, upd: false, response: true});
  const role = await f.db.one('SELECT rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  assert.ok(Object.values(role).every(x => x === false));
  for (const query of ['UPDATE idempotency SET owner=owner', 'UPDATE idempotency SET fingerprint=fingerprint',
    'DELETE FROM idempotency', 'TRUNCATE idempotency', 'UPDATE media SET filename=filename',
    'DELETE FROM audit', 'UPDATE migrations SET checksum=checksum', 'CREATE TABLE forbidden(id int)']) {
    await assert.rejects(f.db.query(query), e => e.code === '42501', query);
  }
});

test('Omitting response UPDATE reproduces complete permission failure and preserves pending without media or audit', async t => {
  const f = await fixture(t), g = await f.grant(); f.objects.set(g.id + '.mp4', f.body);
  await f.owner.query(`REVOKE UPDATE (response) ON ${f.db.schema}.idempotency FROM ${f.role}`);
  await assert.rejects(f.complete(g.id), e => e.code === '42501');
  assert.equal((await f.status(g.id)).state, 'pending');
  assert.equal((await f.db.one('SELECT count(*) n FROM media')).n, 0);
  assert.equal((await f.db.one("SELECT count(*) n FROM audit WHERE action='media.upload'")).n, 0);
});

test('Documented minimum role completes SHA/media/audit atomically, remains idempotent and cleans isolated orphans', async t => {
  const f = await fixture(t), g = await f.grant(); f.objects.set(g.id + '.mp4', f.body);
  assert.equal((await f.complete(g.id)).state, 'verifying');
  await f.worker.tick();
  const done = await f.status(g.id); assert.equal(done.state, 'done');
  const media = await f.db.one('SELECT * FROM media WHERE id=$1', [g.id]);
  assert.equal(media.size, f.body.length); assert.equal(media.mime, 'video/mp4');
  assert.equal(media.sha256, createHash('sha256').update(f.body).digest('hex'));
  await f.complete(g.id); await f.worker.tick();
  assert.equal((await f.db.one('SELECT count(*) n FROM media')).n, 1);
  assert.equal((await f.db.one("SELECT count(*) n FROM audit WHERE action='media.upload' AND object=$1", [g.id])).n, 1);
  const orphan = await f.grant(); f.objects.set(orphan.id + '.mp4', f.body);
  f.advance(900001); await f.worker.tick();
  assert.equal(f.objects.has(orphan.id + '.mp4'), false);
  assert.equal(f.objects.has(g.id + '.mp4'), true);
  assert.equal((await f.status(orphan.id)).state, 'expired');
  assert.equal((await f.db.one('SELECT count(*) n FROM media')).n, 1);
  assert.deepEqual(f.errors, []);
});
