// Migration has no HTTP, storage, authentication or seed runtime dependencies.
// Keep this entry separate so the server's full configuration stays fail-closed.
export function migrationConfiguration(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('必须配置DATABASE_URL');
  let url;
  try { url = new URL(env.DATABASE_URL); }
  catch { throw new Error('数据库连接配置无效'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('仅支持PostgreSQL');
  const schema = env.PGSCHEMA || 'app';
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('无效数据库Schema');
  const max = Number(env.PGPOOL_MAX || 1);
  if (!Number.isInteger(max) || max < 1 || max > 50) throw new Error('PGPOOL_MAX须为1—50');
  return {connectionString: env.DATABASE_URL, schema, max};
}
