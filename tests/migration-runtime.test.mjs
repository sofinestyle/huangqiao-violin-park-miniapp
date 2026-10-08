import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID, createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {migrationConfiguration} from '../server/pg/migration-config.mjs';
import {configuration} from '../server/config.mjs';
import {openPostgres} from '../server/pg/database.mjs';
import {testConnection} from './pg-test-db.mjs';

const url = 'postgresql://127.0.0.1/hq_test_config';
const run = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/migrate-pg.mjs', import.meta.url));

test('Migration config: DATABASE_URL alone, default app schema and one connection', () => {
  assert.deepEqual(migrationConfiguration({DATABASE_URL: url}), {connectionString: url, schema: 'app', max: 1});
  const connectionString = url + '?sslmode=verify-full';
  assert.deepEqual(migrationConfiguration({DATABASE_URL: connectionString, PGSCHEMA: 'custom_app', PGPOOL_MAX: '2'}), {connectionString, schema: 'custom_app', max: 2});
});

test('Migration config: unrelated staging/runtime variables are not validated or returned', () => {
  const env = {DATABASE_URL: url, APP_ENV: 'staging', ADMIN_ORIGIN: 'invalid', PORT: 'invalid', STORAGE_PROVIDER: 'invalid', LOCAL_DEV_AUTH: 'invalid', HQ_SEED_MODE: 'invalid', WECHAT_APP_SECRET: 'synthetic-unused'};
  assert.deepEqual(migrationConfiguration(env), migrationConfiguration({DATABASE_URL: url}));
});

test('Migration config: missing/invalid database URL fails without exposing input', () => {
  for (const value of [undefined, '', 'not a URL synthetic-password', 'https://user:synthetic-password@example.invalid/db', 'sqlite:/file']) {
    assert.throws(() => migrationConfiguration({DATABASE_URL: value}), error => {
      assert.doesNotMatch(error.message, /synthetic-password/);
      return /DATABASE_URL|数据库连接配置|仅支持PostgreSQL/.test(error.message);
    });
  }
});

test('Migration config: schema injection and invalid pool limits rejected before connection', () => {
  for (const schema of ['app;DROP SCHEMA public', 'a.b', 'UPPER', 'a'.repeat(64)]) {
    assert.throws(() => migrationConfiguration({DATABASE_URL: url, PGSCHEMA: schema}), /Schema/);
  }
  for (const max of ['0', '-1', '51', '1.5', 'NaN', 'Infinity']) {
    assert.throws(() => migrationConfiguration({DATABASE_URL: url, PGPOOL_MAX: max}), /PGPOOL_MAX/);
  }
});

test('Server runtime still requires staging origin and private storage configuration', () => {
  const env = {APP_ENV: 'staging', DATABASE_URL: url};
  assert.throws(() => configuration(env), /ADMIN_ORIGIN/);
  env.ADMIN_ORIGIN = 'https://admin.example.invalid';
  assert.throws(() => configuration(env), /CloudBase私有存储/);
  env.STORAGE_PROVIDER = 'cloudbase';
  assert.throws(() => configuration(env), /配置不完整/);
  Object.assign(env, {CLOUDBASE_ENV_ID: 'synthetic', CLOUDBASE_BUCKET: 'private', CLOUDBASE_SERVICE_ROLE_KEY: 'synthetic-unused'});
  assert.equal(configuration(env).database.max, 10);
  assert.throws(() => configuration({...env, LOCAL_DEV_AUTH: 'true'}), /禁止测试/);
  assert.throws(() => configuration({...env, HQ_SEED_MODE: 'development'}), /禁止测试/);
});

test('Migration CLI: invalid config exits nonzero before database access, with no credential echo', async () => {
  await assert.rejects(run(process.execPath, [script], {env: {DATABASE_URL: 'invalid-synthetic-password'}, timeout: 10000}), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /数据库连接配置无效/);
    assert.doesNotMatch(error.stderr + error.stdout, /invalid-synthetic-password|ADMIN_ORIGIN|CloudBase/);
    return true;
  });
});

test('Migration CLI: isolated PG staging config, 13 tables, repeat checksum and mismatch rejection', async t => {
  // Strict localhost + hq_test_ guard; never inherit DATABASE_URL or load .env.
  const connectionString = testConnection();
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  const db = openPostgres({connectionString, schema, max: 1});
  t.after(async () => {try {await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);} finally {await db.close();}});
  const env = {DATABASE_URL: connectionString, PGSCHEMA: schema, APP_ENV: 'staging'};
  const first = await run(process.execPath, [script], {env, timeout: 20000});
  assert.match(first.stdout, /迁移已核验/);
  assert.equal(first.stderr, '');
  const tables = await db.many('SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name', [schema]);
  assert.deepEqual(tables.map(row => row.table_name), ['accounts', 'audit', 'bookings', 'changes', 'consultations', 'content', 'idempotency', 'media', 'migrations', 'product_skus', 'sessions', 'slots', 'visitors']);
  const sql = await readFile(new URL('../pg/migrations/001_initial_schema.sql', import.meta.url));
  assert.equal((await db.one('SELECT checksum FROM migrations WHERE version=1')).checksum, createHash('sha256').update(sql).digest('hex'));
  await run(process.execPath, [script], {env, timeout: 20000});
  assert.equal((await db.one('SELECT count(*) n FROM migrations')).n, 1);
  await db.execute("UPDATE migrations SET checksum='synthetic-mismatch'");
  await assert.rejects(run(process.execPath, [script], {env, timeout: 20000}), error => error.code === 1 && /校验和不匹配/.test(error.stderr));
  assert.equal((await db.one('SELECT count(*) n FROM content')).n, 0);
});
