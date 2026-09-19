import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { SKILLS, schedule } from './engine.js';

export function openDatabase(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(directory, 'maths.sqlite3'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS account (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS throttle (id INTEGER PRIMARY KEY CHECK(id=1), failures INTEGER NOT NULL, since INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bands (skill TEXT NOT NULL, level INTEGER NOT NULL,
      step INTEGER NOT NULL DEFAULT -1, due INTEGER NOT NULL DEFAULT 0, last_day INTEGER NOT NULL DEFAULT -1,
      comfortable_days INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(skill,level));
    CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, skill TEXT NOT NULL, level INTEGER NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS reviews (question_id TEXT PRIMARY KEY REFERENCES questions(id), rating TEXT NOT NULL, at INTEGER NOT NULL);
    `);
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('PRAGMA table_info(account)').all().some(column => column.name === 'username')) {
      db.exec("ALTER TABLE account ADD COLUMN username TEXT NOT NULL DEFAULT 'admin'; DELETE FROM sessions;");
    }
    db.exec('PRAGMA user_version=2; COMMIT;');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  for (const skill of Object.keys(SKILLS)) db.prepare('INSERT OR IGNORE INTO bands(skill,level) VALUES (?,0)').run(skill);
  return db;
}

export function recordReview(db, id, rating, now) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const q = db.prepare('SELECT * FROM questions WHERE id=?').get(id);
    if (!q) { const error = new Error('Question not found. Your local answer has been kept.'); error.status = 404; throw error; }
    if (db.prepare('SELECT 1 FROM reviews WHERE question_id=?').get(id)) {
      db.exec('COMMIT'); return { ok: true, alreadySaved: true };
    }
    const before = db.prepare('SELECT * FROM bands WHERE skill=? AND level=?').get(q.skill, q.level);
    const after = schedule(before, rating, now);
    db.prepare('UPDATE bands SET step=?,due=?,last_day=?,comfortable_days=?,attempts=? WHERE skill=? AND level=?')
      .run(after.step, after.due, after.last_day, after.comfortable_days, after.attempts, q.skill, q.level);
    let unlocked = false;
    if (after.comfortable_days >= 3 && q.level < 2) {
      unlocked = db.prepare('INSERT OR IGNORE INTO bands(skill,level,due) VALUES (?,?,?)').run(q.skill, q.level + 1, now + 86_400_000).changes > 0;
    }
    db.prepare('INSERT INTO reviews VALUES (?,?,?)').run(id, rating, now);
    db.exec('COMMIT');
    return { ok: true, unlocked, due: after.due };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
