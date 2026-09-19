const $ = id => document.getElementById(id);
const storageKey = 'little-by-little-v1';
let local, storageAvailable = true, busy = false, state, authenticated = false;
try { local = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { storageAvailable = false; }
local = local && typeof local === 'object' ? local : {};
local.pending = Array.isArray(local.pending) ? local.pending : [];
local.count = Number.isInteger(local.count) ? local.count : 0;
local.mode = ['daily', 'free'].includes(local.mode) ? local.mode : 'daily';
local.skill ||= 'all';

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(local)); storageAvailable = true; return true; }
  catch { storageAvailable = false; return false; }
}
function status(message, warning = false, retry = false) {
  $('connection').textContent = message;
  $('connection').classList.toggle('warning', warning);
  if (retry) { const b = document.createElement('button'); b.textContent = 'Retry'; b.onclick = () => run(resume); $('connection').append(b); }
}
function savedStatus(extra = '') {
  status(storageAvailable ? (extra || 'Progress saved to your server') : 'Server saving is available, but this browser cannot keep a local recovery copy.', !storageAvailable);
}
async function api(route, body) {
  const response = await fetch(`/api/${route}`, { method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Maths-Request': '1' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'Request failed.'); error.status = response.status; throw error; }
  return data;
}
function showLogin() {
  authenticated = false;
  $('login').hidden = false; $('workspace').hidden = true; $('logout').hidden = true;
  status(local.pending.length ? 'An answer is waiting on this device. Sign in to save it.' : 'Your practice, saved between visits.');
}
async function run(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button,select,input').forEach(e => { e.disabled = true; });
  try { await action(); }
  catch (error) {
    if (error.status === 401) { showLogin(); $('login-error').textContent = error.message; }
    else status(local.pending.length ? `Answer not saved to the server yet. ${storageAvailable ? 'A recovery copy is on this device.' : 'Keep this page open to avoid losing it.'} ${error.message}` : `Could not connect. ${error.message}`, true, true);
  } finally {
    busy = false;
    document.querySelectorAll('button,select,input').forEach(e => { e.disabled = false; });
    if (local.wrong) document.querySelectorAll('[data-rating]:not([data-rating="missed"])').forEach(e => { e.disabled = true; });
    if (local.pending.length) document.querySelectorAll('[data-rating],#mode,#skill,#typed,#reveal').forEach(e => { e.disabled = true; });
  }
}
async function flush() {
  let unlocked = false, missed = false;
  while (local.pending.length) {
    const result = await api('review', local.pending[0]);
    missed ||= local.pending[0].rating === 'missed';
    unlocked ||= result.unlocked;
    local.pending.shift();
    local.count += 1;
    local.previous = local.question?.skill;
    local.question = null; local.revealed = false; local.wrong = false;
    persist();
  }
  savedStatus(missed ? 'Saved — this skill will return until you get it right.' : unlocked ? 'A new difficulty is unlocked for tomorrow. Progress saved.' : '');
}
async function refresh() {
  state = await api('state');
  if ($('skill').options.length === 1) for (const s of state.skills) $('skill').add(new Option(s.name, s.id));
  if (![...$('skill').options].some(o => o.value === local.skill)) local.skill = 'all';
  $('skill').value = local.skill; $('mode').value = local.mode; $('typed').checked = Boolean(local.typed);
  renderProgress();
}
function renderQuestion() {
  const q = local.question;
  $('question-card').hidden = !q; $('finish').hidden = Boolean(q);
  $('counter').textContent = local.count >= 10 && q ? `${local.count} done · Retry` : `${local.count} / 10`;
  $('progress-bar').style.width = `${Math.min(local.count, 10) * 10}%`;
  $('session-label').textContent = local.mode === 'daily' ? 'DAILY PRACTICE' : 'FREE PRACTICE';
  if (!q) return;
  $('question').textContent = q.prompt;
  $('level-label').textContent = state.levels[q.level];
  $('question-caption').textContent = q.retry ? 'Try another from this skill' : local.typed ? 'Work it out, then enter your answer' : 'Work it out in your head';
  $('answer-form').hidden = Boolean(local.revealed);
  $('answer-input').hidden = !local.typed;
  $('answer-input').value = local.entry || '';
  $('reveal').textContent = local.typed ? 'Check answer' : 'Show answer';
  $('answer-panel').hidden = !local.revealed;
  $('answer').textContent = q.answer;
  $('method').textContent = q.method; $('steps').textContent = q.steps;
  $('correctness').textContent = local.typed ? (local.wrong ? `Your answer: ${local.entry} · Not quite` : 'Correct') : 'ANSWER';
  if (local.revealed) document.querySelectorAll('[data-rating]').forEach(e => { e.disabled = local.wrong && e.dataset.rating !== 'missed'; });
}
function finish(nextDue) {
  local.question = null; local.revealed = false; persist(); renderQuestion();
  $('level-label').textContent = '';
  $('finish-title').textContent = local.count >= 10 ? 'A little further along.' : 'You’re up to date.';
  const when = nextDue ? new Date(nextDue).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }) : null;
  $('finish-text').textContent = `${local.count ? `${local.count} question${local.count === 1 ? '' : 's'} practised. ` : ''}${when ? `Next review: ${when}. You can still practise whenever you like.` : 'Your progress is saved. Stop here, or do another short round.'}`;
}
async function nextQuestion() {
  if (!local.question) {
    const q = await api('question', { mode: local.mode, skill: local.skill, previous: local.previous, retryOnly: local.count >= 10 });
    if (q.done) return finish(q.nextDue);
    local.question = q; local.revealed = false; local.wrong = false; local.entry = ''; persist();
  }
  renderQuestion();
}
async function resume() {
  await refresh(); authenticated = true;
  $('login').hidden = true; $('workspace').hidden = false; $('logout').hidden = false;
  await flush(); await refresh();
  const today = Math.floor(state.now / 86400000);
  if (local.sessionDay !== today) {
    local.count = 0; local.sessionDay = today; persist();
  }
  await nextQuestion();
}
function renderProgress() {
  $('progress-summary').textContent = `${state.total} answers saved · ${state.due} skill level${state.due === 1 ? '' : 's'} due for review`;
  $('skill-list').replaceChildren();
  for (const skill of state.skills) {
    const bands = state.bands.filter(b => b.skill === skill.id), highest = Math.max(...bands.map(b => b.level));
    const next = Math.min(...bands.map(b => b.due)), due = next <= state.now;
    const row = document.createElement('div'); row.className = 'skill-row';
    const top = document.createElement('div'); top.className = 'skill-top';
    const name = document.createElement('strong'); name.textContent = skill.name;
    const label = document.createElement('span'); label.textContent = due ? 'Due now' : `Next: ${new Date(next).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
    top.append(name, label);
    const track = document.createElement('div'); track.className = 'bands'; track.setAttribute('aria-hidden', 'true');
    for (let level = 0; level < 3; level++) { const b = document.createElement('span'); b.className = `band${level <= highest ? ' unlocked' : ''}`; track.append(b); }
    const text = document.createElement('p');
    const days = Math.min(3, bands.find(b => b.level === highest).comfortable_days);
    text.textContent = `${state.levels[highest]} · ${highest < 2 ? `${days}/3 comfortable days toward the next level` : 'All three levels unlocked'}`;
    row.append(top, track, text); $('skill-list').append(row);
  }
}
$('login-form').addEventListener('submit', e => { e.preventDefault(); run(async () => { $('login-error').textContent = ''; await api('login', { username: $('username').value, password: $('password').value }); $('password').value = ''; await resume(); }); });
$('logout').onclick = () => run(async () => { await flush(); await api('logout', {}); showLogin(); });
$('answer-form').addEventListener('submit', e => {
  e.preventDefault(); if (busy || !local.question || local.pending.length) return;
  if (local.typed) {
    const raw = $('answer-input').value.trim().replace(',', '.');
    if (!/^\d+(?:\.\d+)?$/.test(raw)) { $('answer-input').setCustomValidity('Enter a number, such as 16 or 16.4.'); $('answer-input').reportValidity(); return; }
    local.entry = raw;
    local.wrong = Math.abs(Number(raw) - Number(local.question.answer)) > 0.000001;
  }
  local.revealed = true; persist(); renderQuestion();
  $('answer-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
$('answer-input').oninput = () => $('answer-input').setCustomValidity('');
document.querySelectorAll('[data-rating]').forEach(b => { b.onclick = () => run(async () => {
  if (!local.question || !local.revealed || local.pending.length) return;
  local.pending.push({ id: local.question.id, rating: local.wrong ? 'missed' : b.dataset.rating });
  persist(); status('Saving your answer…');
  await flush(); await refresh(); await nextQuestion();
}); });
for (const id of ['mode', 'skill']) $(id).onchange = () => run(async () => {
  await flush(); local[id] = $(id).value; local.count = 0; local.question = null; local.wrong = false; persist(); await nextQuestion();
});
$('typed').onchange = () => { local.typed = $('typed').checked; local.revealed = false; local.wrong = false; local.entry = ''; persist(); renderQuestion(); };
$('continue').onclick = () => run(async () => { local.mode = 'free'; local.count = 0; local.question = null; local.wrong = false; persist(); $('mode').value = 'free'; await nextQuestion(); });
function showView(progress) {
  $('practice-view').hidden = progress; $('progress-view').hidden = !progress;
  $('practice-tab').toggleAttribute('aria-current', !progress); $('progress-tab').toggleAttribute('aria-current', progress);
}
$('practice-tab').onclick = () => showView(false);
$('progress-tab').onclick = () => run(async () => { await refresh(); showView(true); });
window.addEventListener('online', () => { if (authenticated) run(resume); });
window.addEventListener('offline', () => status('Connection lost. Your current answer can be kept on this device until you reconnect.', true));
// Optional agent support uses the same visible state; never submits ratings on a user's behalf.
if (document.modelContext?.registerTool) {
  try { Promise.resolve(document.modelContext.registerTool({ name: 'read_practice_progress', description: 'Read the signed-in mental maths progress currently shown by the app.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: async input => {
    if (input && Object.keys(input).length) throw new Error('No arguments expected.');
    if (!authenticated) throw new Error('Sign in first.');
    await refresh(); return { total: state.total, due: state.due, bands: state.bands };
  } })).catch(() => {}); } catch { /* Unsupported browsers continue normally. */ }
}
run(resume);
