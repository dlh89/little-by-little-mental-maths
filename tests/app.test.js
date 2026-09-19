import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';
import { setPassword } from '../auth.js';
import { SKILLS, makeQuestion, schedule, DAY } from '../engine.js';
import { openDatabase } from '../db.js';
import { DatabaseSync } from 'node:sqlite';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const blank = () => ({ skill: 'divide5', level: 0, step: -1, due: 0, last_day: -1, comfortable_days: 0, attempts: 0 });
test('all arithmetic and percentage generators produce correct finite answers at all difficulties', () => {
  for (const [skill, spec] of Object.entries(SKILLS)) for (let level = 0; level < 3; level++) {
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion(skill, level);
      const answer = spec.op === '÷' ? Number(q.operand) / spec.factor : spec.op === '%' ? Number(q.operand) * spec.factor / 100 : Number(q.operand) * spec.factor;
      assert.ok(Math.abs(answer - Number(q.answer)) < 1e-8, q.prompt);
      assert.ok(!q.prompt.includes('000000000'));
      if (level === 0 && spec.op === '÷') assert.ok(Number.isInteger(Number(q.answer)));
      if (level === 2 && spec.op === '÷') assert.ok(!Number.isInteger(Number(q.answer)));
      if (spec.op === '%') {
        assert.equal(q.prompt, `${spec.factor}% of ${q.operand}`);
        if (level === 0) assert.ok(Number.isInteger(Number(q.answer)));
      }
      assert.ok(q.method.length > 0 && q.steps.length > 0);
    }
  }
});
test('spacing advances by days, misses recover quickly, and same-day repeats cannot inflate mastery', () => {
  const now = DAY * 20;
  const first = schedule(blank(), 'comfortable', now);
  assert.equal(first.due, now + DAY);
  const repeat = schedule(first, 'comfortable', now + 100);
  assert.equal(repeat.comfortable_days, 1); assert.equal(repeat.step, 0);
  const next = schedule(repeat, 'comfortable', now + DAY);
  assert.equal(next.due, now + DAY * 4);
  const missed = schedule(next, 'missed', now + DAY * 4);
  assert.equal(missed.due, now + DAY * 4 + 300_000); assert.equal(missed.comfortable_days, 0);
  const recovery = schedule(missed, 'comfortable', now + DAY * 4 + 301_000);
  assert.equal(recovery.comfortable_days, 0);
  assert.equal(recovery.due, now + DAY * 5 + 301_000);
  assert.equal(schedule(recovery, 'slow', now + DAY * 4 + 302_000).due, now + DAY * 5 + 302_000);
});
test('login, CSRF, idempotent saves, difficulty unlocks, logout and backup recovery', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'maths-test-'));
  let time = DAY * 100;
  const app = createApp({ dataDir: dir, now: () => time });
  await setPassword(app.db, 'test-password-long-enough');
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); app.db.close(); rmSync(dir, { recursive: true, force: true }); });
  let cookie = '';
  const call = async (route, body, extra = {}) => fetch(base + '/api/' + route, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'http://127.0.0.1:8765', 'X-Maths-Request': '1', 'Content-Type': 'application/json', Cookie: cookie, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal((await call('state')).status, 401);
  assert.equal((await call('login', { username: 'admin', password: 'test-password-long-enough' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await call('login', { username: 'admin', password: 'wrong' })).status, 401);
  assert.equal((await call('login', { username: 'someone-else', password: 'test-password-long-enough' })).status, 401);
  assert.equal((await call('login', { password: 'test-password-long-enough' })).status, 401);
  const login = await call('login', { username: 'admin', password: 'test-password-long-enough' });
  assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await call('state')).json()).bands.length, Object.keys(SKILLS).length);
  assert.equal((await call('question', { skill: '__proto__' })).status, 400);
  const q = await (await call('question', { mode: 'daily', skill: 'divide5' })).json();
  assert.equal((await call('review', { id: q.id, rating: 'bogus' })).status, 400);
  assert.equal((await call('review', { id: q.id, rating: 'comfortable' })).status, 200);
  assert.equal((await (await call('review', { id: q.id, rating: 'comfortable' })).json()).alreadySaved, true);
  assert.equal((await (await call('state')).json()).total, 1);
  assert.equal((await (await call('question', { mode: 'daily', skill: 'divide5' })).json()).done, true);
  for (const day of [101, 104]) {
    time = DAY * day;
    const next = await (await call('question', { mode: 'daily', skill: 'divide5' })).json();
    await call('review', { id: next.id, rating: 'comfortable' });
  }
  const state = await (await call('state')).json();
  assert.equal(state.bands.filter(b => b.skill === 'divide5').length, 2);
  assert.equal(state.total, 3);
  const exported = await (await call('export')).json();
  assert.equal(exported.reviews.length, 3); assert.ok(!JSON.stringify(exported).includes('password'));
  const destination = path.join(dir, 'copy.sqlite3');
  execFileSync(process.execPath, ['scripts/admin.js', 'backup', destination], { cwd: root, env: { ...process.env, DATA_DIR: dir }, stdio: 'pipe' });
  const restoreDir = path.join(dir, 'restored'); mkdirSync(restoreDir); copyFileSync(destination, path.join(restoreDir, 'maths.sqlite3'));
  const restored = openDatabase(restoreDir);
  assert.equal(restored.prepare('SELECT count(*) AS n FROM reviews').get().n, 3);
  assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); restored.close();
  await call('logout', {}); assert.equal((await call('state')).status, 401);
});
test('password-only databases migrate without losing account or progress; usernames can be changed', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'maths-migration-'));
  const legacy = new DatabaseSync(path.join(dir, 'maths.sqlite3'));
  legacy.exec("CREATE TABLE account (id INTEGER PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL); INSERT INTO account VALUES (1,'old-salt','old-hash'); CREATE TABLE sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL); INSERT INTO sessions VALUES ('old-session',9999999999999);");
  legacy.close();
  const db = openDatabase(dir);
  try {
    const account = db.prepare('SELECT * FROM account').get();
    assert.equal(account.username, 'admin'); assert.equal(account.hash, 'old-hash');
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
    db.prepare('UPDATE bands SET attempts=7 WHERE skill=?').run('divide5');
    await setPassword(db, 'a-new-long-password', ' David ');
    assert.equal(db.prepare('SELECT username FROM account').get().username, 'david');
    await setPassword(db, 'another-long-password');
    assert.equal(db.prepare('SELECT username FROM account').get().username, 'david');
    assert.equal(db.prepare("SELECT attempts FROM bands WHERE skill='divide5'").get().attempts, 7);
    await assert.rejects(setPassword(db, 'another-long-password', 'bad user'));
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('production requires HTTPS and uses a Secure host-only cookie; failed logins are throttled', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'maths-auth-'));
  assert.throws(() => createApp({ dataDir: dir, production: true, origin: 'http://maths.example.com' }));
  const app = createApp({ dataDir: dir, production: true, origin: 'https://maths.example.com' });
  await setPassword(app.db, 'test-password-long-enough');
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); app.db.close(); rmSync(dir, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${app.server.address().port}/api/login`;
  const login = password => fetch(url, { method: 'POST', headers: { Origin: 'https://maths.example.com', 'X-Maths-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password }) });
  const valid = await login('test-password-long-enough');
  assert.match(valid.headers.get('set-cookie'), /^__Host-maths=.*; Secure$/);
  for (let i = 0; i < 10; i++) assert.equal((await login('incorrect')).status, 401);
  assert.equal((await login('incorrect')).status, 429);
});

test('missed skills repeat until correct, survive restart, and cannot be skipped at the round limit', async t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'maths-retry-'));
  const time = DAY * 100;
  let app = createApp({ dataDir: dir, now: () => time });
  await setPassword(app.db, 'test-password-long-enough');
  const start = async () => { await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); };
  await start();
  let cookie = '';
  const call = async (route, body) => {
    const response = await fetch(`http://127.0.0.1:${app.server.address().port}/api/${route}`, {
      method: 'POST', headers: { Origin: 'http://127.0.0.1:8765', 'X-Maths-Request': '1', 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    if (route === 'login') cookie = response.headers.get('set-cookie').split(';')[0];
    return response.json();
  };
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); app.db.close(); rmSync(dir, { recursive: true, force: true }); });
  await call('login', { username: 'admin', password: 'test-password-long-enough' });
  const first = await call('question', { skill: 'divide5' });
  await call('review', { id: first.id, rating: 'missed' });
  for (let i = 0; i < 2; i++) {
    const other = await call('question', {});
    assert.notEqual(other.skill, first.skill);
    await call('review', { id: other.id, rating: 'comfortable' });
  }
  const retry = await call('question', {});
  assert.equal(retry.skill, first.skill); assert.equal(retry.level, first.level);
  assert.equal(retry.retry, true); assert.notEqual(retry.prompt, first.prompt);
  await call('review', { id: retry.id, rating: 'missed' });
  await new Promise(resolve => app.server.close(resolve)); app.db.close();
  app = createApp({ dataDir: dir, now: () => time }); await start();
  const endOfRound = await call('question', { retryOnly: true });
  assert.equal(endOfRound.skill, first.skill); assert.equal(endOfRound.retry, true);
  await call('review', { id: endOfRound.id, rating: 'missed' });
  const again = await call('question', { skill: first.skill });
  assert.equal(again.retry, true); // Single-skill practice retries immediately.
  await call('review', { id: again.id, rating: 'slow' });
  assert.equal((await call('question', { retryOnly: true })).done, true);
  // A comfortable answer also clears a miss before the five-minute fallback expires.
  const extra = await call('question', { skill: first.skill, mode: 'free' });
  await call('review', { id: extra.id, rating: 'missed' });
  const last = await call('question', { retryOnly: true });
  await call('review', { id: last.id, rating: 'comfortable' });
  assert.equal((await call('question', { skill: first.skill })).done, true);
  assert.equal(app.db.prepare('SELECT due FROM bands WHERE skill=? AND level=0').get(first.skill).due, time + DAY);
});
