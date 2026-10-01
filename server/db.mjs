import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, data TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'draft', sort INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      roles TEXT NOT NULL, can_export INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, wechat_openid TEXT UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL, type TEXT NOT NULL,
      expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS slots (id TEXT PRIMARY KEY, date TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK(capacity>0), package_ids TEXT NOT NULL, paused INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES visitors(id),
      snapshot TEXT NOT NULL, request TEXT NOT NULL, confirmed TEXT, state TEXT NOT NULL, slot_id TEXT REFERENCES slots(id),
      headcount INTEGER NOT NULL CHECK(headcount>0), assignee TEXT REFERENCES accounts(id),
      contact_log TEXT NOT NULL DEFAULT '[]', public_note TEXT NOT NULL DEFAULT '', arrived_at TEXT,
      version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS bookings_owner ON bookings(owner);
    CREATE INDEX IF NOT EXISTS bookings_slot ON bookings(slot_id,state);
    CREATE TABLE IF NOT EXISTS changes (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id),
      type TEXT NOT NULL, data TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
      result TEXT, created_at TEXT NOT NULL, handled_at TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS changes_pending ON changes(booking_id) WHERE state='pending';
    CREATE TABLE IF NOT EXISTS consultations (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES visitors(id),
      snapshot TEXT NOT NULL, request TEXT NOT NULL, state TEXT NOT NULL, assignee TEXT REFERENCES accounts(id),
      followups TEXT NOT NULL DEFAULT '[]', public_note TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS consultations_owner ON consultations(owner);
    CREATE TABLE IF NOT EXISTS idempotency (owner TEXT NOT NULL, route TEXT NOT NULL, key TEXT NOT NULL,
      fingerprint TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(owner,route,key));
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime TEXT NOT NULL,
      size INTEGER NOT NULL, sha256 TEXT NOT NULL, stored_name TEXT NOT NULL, rights TEXT NOT NULL,
      duration REAL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL,
      action TEXT NOT NULL, object TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    INSERT OR IGNORE INTO migrations VALUES (1, datetime('now'));`);
  return db;
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const value = fn(); db.exec('COMMIT'); return value; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
export const now = () => new Date().toISOString();
export const decode = value => value ? JSON.parse(value) : null;
