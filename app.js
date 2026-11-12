/* Carnet d'entraînement — logique principale */
import * as DB from './db.js';
import { LIB, MUSCLES, EQUIPS } from './exercises.js';
import { $, $$, esc, uid, norm, icon, dstr, parseD, num, fmtN, fmtDur, fmtClock, fmtLong, fmtShort, fmtFull, fmtMonth, cap,
  openSheet, closeSheet, ask, choose, form, toast, lineChart } from './ui.js';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DEFAULTS = { name: '', height: 0, bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5], step: 2.5, rest: 90,
  weighDays: 7, backupWeeks: 2, lastBackup: 0, sound: true, vibrate: true };
const TYPES = { N: 'Série normale', W: 'Échauffement', D: 'Dropset', F: "Jusqu'à l'échec" };

const S = { settings: { ...DEFAULTS }, active: null, sessions: [], programs: [], templates: [], weights: [], custom: [], ui: {}, tl: null };
const ACT = {}, BIND = {}, LIVE = {};
let EXMAP = new Map();

/* ================= Helpers ================= */
const plu = (n, s, p) => (n > 1 ? (p || s + 's') : s);
const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
const round2 = v => Math.round(v * 100) / 100;
const go = h => { if (location.hash === h) route(); else location.hash = h; };
const saveSettings = () => DB.kvSet('settings', S.settings);
const persist = () => DB.kvSet('active', S.active);
const unitLabel = u => (u === 's' ? 'Sec' : u === 'min' ? 'Min' : 'Reps');
const hms = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; const p = n => String(n).padStart(2, '0'); return h ? `${h}:${p(m)}:${p(x)}` : `${m}:${p(x)}`; };

function rebuildEx() {
  EXMAP = new Map();
  for (const e of LIB) EXMAP.set(e.id, e);
  for (const e of S.custom) { e._n = norm(`${e.name} ${e.muscle} ${e.equip}`); EXMAP.set(e.id, e); }
}
const allEx = () => [...EXMAP.values()];
function filterEx(q, mu, eq) {
  const toks = norm(q || '').split(/\s+/).filter(Boolean);
  return allEx().filter(x => (!mu || x.muscle === mu) && (!eq || x.equip === eq) && toks.every(t => x._n.includes(t))).sort(byName);
}

const sessDate = s => new Date(s.startedAt);
const sessVol = s => { let v = 0; for (const e of s.exercises) { if (e.unit) continue; for (const x of e.sets) if (x.done && x.type !== 'W') v += x.weight * x.reps; } return v; };
const sessDone = s => s.exercises.reduce((n, e) => n + e.sets.filter(x => x.done).length, 0);
const sessTotal = s => s.exercises.reduce((n, e) => n + e.sets.length, 0);
const sessSecs = s => ((s.endedAt || Date.now()) - s.startedAt) / 1000;
const sortedSessions = () => [...S.sessions].sort((a, b) => b.startedAt - a.startedAt);

function setStr(x, unit) {
  const tag = x.type === 'D' ? ' (D)' : x.type === 'F' ? ' (F)' : x.type === 'W' ? ' (é)' : '';
  if (unit === 'min') return `${fmtN(x.reps)} min${tag}`;
  if (unit === 's') return (x.weight ? `${fmtN(x.weight)} kg × ` : '') + `${fmtN(x.reps)} s${tag}`;
  return x.weight ? `${fmtN(x.weight)} × ${fmtN(x.reps)}${tag}` : `${fmtN(x.reps)} reps${tag}`;
}

function lastPerf(exId) {
  for (const s of sortedSessions()) {
    for (const e of s.exercises) {
      if (e.exId !== exId) continue;
      const ws = e.sets.filter(x => x.done && x.type !== 'W');
      if (ws.length) return { weight: Math.max(...ws.map(x => x.weight)), reps: ws[0].reps, sets: ws.length };
    }
  }
  return null;
}
const roundStep = v => { const st = S.settings.step || 2.5; return Math.round(v / st) * st; };
const defReps = u => (u === 's' ? 30 : u === 'min' ? 20 : 10);

const head = (title, { back = false, right = '', sub = '' } = {}) =>
  `<header class="top">${back ? `<button class="ib" data-act="back" aria-label="Retour">${icon('chevL', 24)}</button>` : ''}<div class="tt"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="right">${right}</div></header>`;

const chipRow = (attrs, k, values, cur, allLabel) =>
  `<div class="chips scroll" data-k="${k}">${values.map(v => `<button class="chip${v === cur ? ' on' : ''}" ${attrs} data-k="${k}" data-v="${esc(v)}">${v ? esc(v) : allLabel}</button>`).join('')}</div>`;

const stepper = (f, v, extra = '') =>
  `<div class="step"><button data-act="step" data-f="${f}" data-d="-1" aria-label="Moins">−</button><input type="text" inputmode="decimal" data-bind="setIn" data-f="${f}" value="${fmtN(v)}" ${extra}><button data-act="step" data-f="${f}" data-d="1" aria-label="Plus">+</button></div>`;

/* ================= Démarrage ================= */
async function boot() {
  await DB.open();
  const [settings, active, sessions, programs, templates, weights, custom] = await Promise.all([
    DB.kvGet('settings'), DB.kvGet('active'), DB.all('sessions'), DB.all('programs'), DB.all('templates'), DB.all('weights'), DB.all('exercises')]);
  S.settings = { ...DEFAULTS, ...(settings || {}) };
  S.active = active || null;
  Object.assign(S, { sessions, programs, templates, weights, custom });
  rebuildEx();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  bindGlobal();
  if (S.active && (!location.hash || location.hash === '#/home')) history.replaceState(null, '', '#/session');
  await route();
  if (S.active) lockScreen();
  setInterval(tick, 250);
}

/* ================= Routeur ================= */
const parentOf = h => {
  const p = h.slice(2).split('/');
  if (p[0] === 'template' || p[0] === 'library') return '#/programs';
  if (p[0] === 'history' && p[1]) return '#/history';
  if (p[0] === 'summary') return '#/home';
  if (p[0] === 'progress' && p[1] === 'exo') return '#/progress';
  if (p[0] === 'timelapse') return '#/progress/photos';
  return '#/home';
};
ACT.back = () => { if (history.length > 1) history.back(); else location.replace(parentOf(location.hash || '#/home')); };

async function route(keep = false) {
  stopTL();
  const hash = location.hash || '#/home';
  const p = hash.slice(2).split('/');
  let r;
  try {
    switch (p[0]) {
      case 'programs': r = programsScreen(); break;
      case 'template': r = templateScreen(p[1]); break;
      case 'library': r = libraryScreen(); break;
      case 'session': r = sessionScreen(); break;
      case 'summary': r = summaryScreen(p[1]); break;
      case 'history': r = p[1] ? detailScreen(p[1]) : historyScreen(); break;
      case 'progress':
        r = p[1] === 'weight' ? weightScreen() : p[1] === 'photos' ? await photosScreen() : p[1] === 'exo' ? exoScreen(decodeURIComponent(p[2] || '')) : progressScreen();
        break;
      case 'timelapse': r = await timelapseScreen(); break;
      case 'settings': r = settingsScreen(); break;
      default: r = homeScreen();
    }
  } catch (err) {
    console.error(err);
    r = { html: head('Erreur', { back: true }) + `<div class="pad"><p>Un problème est survenu : ${esc(err.message)}</p></div>`, tab: 'home' };
  }
  const y = window.scrollY;
  $('#view').innerHTML = r.html;
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === r.tab));
  document.body.dataset.route = p[0];
  window.scrollTo(0, keep ? y : 0);
  if (r.after) r.after();
}
const render = () => route(true);
window.addEventListener('hashchange', () => route());

/* ================= Accueil ================= */
const lastWeight = () => [...S.weights].sort((a, b) => b.date.localeCompare(a.date))[0] || null;

function weekStats() {
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)).getTime();
  const ss = S.sessions.filter(s => s.startedAt >= mon);
  return { n: ss.length, vol: ss.reduce((a, s) => a + sessVol(s), 0), time: ss.reduce((a, s) => a + sessSecs(s), 0) };
}

function homeScreen() {
  const st = S.settings, now = new Date(), today = DAYS[(now.getDay() + 6) % 7];
  let h = head(st.name ? `Bonjour, ${st.name}` : 'Bonjour', { sub: cap(fmtLong(now)) }) + '<div class="pad">';

  if (S.active) {
    const s = S.active;
    h += `<section class="card hero"><div class="lbl">Séance en cours</div><div class="big">${esc(s.name)}</div>
      <div class="meta"><span data-elapsed>${hms((Date.now() - s.startedAt) / 1000)}</span> · ${sessDone(s)}/${sessTotal(s)} séries</div>
      <button class="btn light block" data-act="resume">Reprendre la séance</button></section>`;
  } else {
    const progs = S.programs.filter(p => !p.archived);
    const tpls = S.templates.filter(t => progs.some(p => p.id === t.programId))
      .sort((a, b) => (b.day === today) - (a.day === today) || DAYS.indexOf(a.day || 'x') - DAYS.indexOf(b.day || 'x') || a.created - b.created);
    if (!tpls.length) {
      h += `<section class="card empty"><b>Bienvenue dans ton carnet</b><p>Crée un programme avec tes séances types (ex. « Lundi – Jambes »), ou lance directement une séance libre.</p><a class="btn primary block" href="#/programs">Créer un programme</a></section>`;
    } else {
      h += `<h2>Lancer une séance</h2><div class="card list">${tpls.map(t => {
        const p = progs.find(x => x.id === t.programId);
        return `<button class="row" data-act="startTpl" data-id="${t.id}"><div><b>${esc(t.name)}</b><small>${esc(p.name)} · ${t.exercises.length} exercice${plu(t.exercises.length, '')}</small></div>${t.day === today ? '<span class="tag on">Aujourd\'hui</span>' : t.day ? `<span class="tag">${esc(t.day)}</span>` : ''}${icon('play', 20)}</button>`;
      }).join('')}</div>`;
    }
    h += `<button class="btn ghost block" data-act="freeSession">${icon('plus', 18)} Séance libre</button>`;
  }

  const lw = lastWeight();
  const dsw = lw ? Math.floor((Date.now() - parseD(lw.date).getTime()) / 864e5) : null;
  if (dsw === null || dsw >= st.weighDays) {
    h += `<div class="card rem">${icon('scale', 24)}<div><b>Pesée</b><small>${lw ? `Dernière pesée : ${dsw === 0 ? "aujourd'hui" : `il y a ${dsw} jour${plu(dsw, '')}`}` : 'Aucune pesée enregistrée'}</small></div><button class="btn sm" data-act="addWeight">Peser</button></div>`;
  }
  if (S.sessions.length && (Date.now() - st.lastBackup) / 864e5 >= st.backupWeeks * 7) {
    h += `<div class="card rem">${icon('download', 24)}<div><b>Sauvegarde</b><small>${st.lastBackup ? `Dernière sauvegarde il y a ${Math.floor((Date.now() - st.lastBackup) / 864e5)} jours` : 'Aucune sauvegarde pour le moment'}</small></div><button class="btn sm" data-act="exportData">Sauvegarder</button></div>`;
  }

  const w = weekStats();
  h += `<h2>Cette semaine</h2><div class="tiles"><div><b>${w.n}</b><small>séance${plu(w.n, '')}</small></div><div><b>${fmtN(Math.round(w.vol))}</b><small>kg soulevés</small></div><div><b>${fmtDur(w.time)}</b><small>d'entraînement</small></div></div>`;

  const last = sortedSessions()[0];
  if (last) {
    h += `<h2>Dernière séance</h2><a class="card row link" href="#/history/${last.id}"><div><b>${esc(last.name)}</b><small>${esc(cap(fmtLong(sessDate(last))))} · ${fmtDur(sessSecs(last))} · ${sessDone(last)} séries</small></div>${icon('chevR', 20)}</a>`;
  }
  return { html: h + '</div>', tab: 'home' };
}

/* ================= Création / démarrage de séance ================= */
const WARM = { 1: [.5], 2: [.4, .7], 3: [.4, .6, .8], 4: [.3, .5, .7, .85] };

function expandTemplate(t) {
  return t.exercises.map(e => {
    const lp = lastPerf(e.exId);
    const w = e.weight || (!e.unit && lp ? lp.weight : 0);
    const sets = [];
    for (const f of WARM[Math.min(e.warm || 0, 4)] || []) sets.push({ type: 'W', weight: roundStep(w * f), reps: e.reps });
    for (let i = 0; i < e.sets; i++) sets.push({ type: i === e.sets - 1 && e.last && e.last !== 'N' ? e.last : 'N', weight: w, reps: e.reps });
    return { exId: e.exId, name: e.name, muscle: e.muscle, unit: e.unit || '', rest: e.rest, ss: !!e.ss, sets };
  });
}
const mkEx = t => ({ k: uid(), exId: t.exId, name: t.name, muscle: t.muscle, unit: t.unit || '', rest: t.rest ?? S.settings.rest, ss: !!t.ss, note: '',
  sets: t.sets.map(x => ({ k: uid(), type: x.type, weight: x.weight, reps: x.reps, done: false })) });

async function canStart() {
  if (!S.active) return true;
  const abandon = await ask({ title: 'Une séance est déjà en cours', msg: "Abandonner la séance en cours pour en commencer une nouvelle ? Les séries déjà validées seront perdues.", ok: 'Abandonner', cancel: 'Reprendre', danger: true });
  if (!abandon) { go('#/session'); return false; }
  await discardActive();
  return true;
}
async function discardActive() { S.active = null; await DB.kvDel('active'); unlockScreen(); hideRest(); }
async function startSession(name, tid, exs) {
  S.active = { id: uid(), name, templateId: tid || null, startedAt: Date.now(), notes: '', exercises: exs.map(mkEx) };
  await persist();
  lockScreen();
  go('#/session');
}
ACT.resume = () => go('#/session');
ACT.startTpl = async el => {
  const t = S.templates.find(x => x.id === el.dataset.id);
  if (!t || !(await canStart())) return;
  startSession(t.name, t.id, expandTemplate(t));
};
ACT.freeSession = async () => { if (await canStart()) startSession('Séance libre', null, []); };
ACT.dupSession = async el => {
  const s = S.sessions.find(x => x.id === el.dataset.id);
  if (!s || !(await canStart())) return;
  startSession(s.name, s.templateId, s.exercises.map(e => ({ exId: e.exId, name: e.name, muscle: e.muscle, unit: e.unit, rest: e.rest, ss: e.ss, sets: e.sets.map(x => ({ type: x.type, weight: x.weight, reps: x.reps })) })));
};

/* ================= Séance en cours ================= */
const getEx = k => S.active && S.active.exercises.find(e => e.k === k);
const findSet = (ek, sk) => { const ex = getEx(ek); return [ex, ex && ex.sets.find(s => s.k === sk)]; };

function sessionScreen() {
  const s = S.active;
  if (!s) return { html: '', tab: 'home', after: () => location.replace('#/home') };
  const right = `<button class="ib" data-act="plates" aria-label="Calculateur de disques">${icon('disc', 24)}</button><button class="ib" data-act="sessMenu" aria-label="Plus">${icon('more', 24)}</button><button class="btn sm primary" data-act="finish">Terminer</button>`;
  let h = head(s.name, { right });
  h += `<div class="strip"><div><b data-elapsed>${hms((Date.now() - s.startedAt) / 1000)}</b><small>Durée</small></div><div><b>${sessDone(s)}/${sessTotal(s)}</b><small>Séries</small></div><div><b>${fmtN(Math.round(sessVol(s)))}</b><small>Volume (kg)</small></div></div><div class="pad">`;
  if (!s.exercises.length) h += `<div class="empty-s">Ajoute ton premier exercice pour commencer.</div>`;
  h += s.exercises.map(exCard).join('');
  h += `<button class="btn ghost block" data-act="addEx">${icon('plus', 18)} Ajouter un exercice</button>
    <label class="fld"><span>Notes de séance</span><textarea rows="3" data-bind="sessNote" placeholder="Sensations, fatigue, remarques…">${esc(s.notes || '')}</textarea></label></div>`;
  return { html: h, tab: 'home' };
}

function exCard(ex) {
  let n = 0;
  const nw = ex.unit === 'min';
  const rows = ex.sets.map(x => {
    if (x.type !== 'W') n++;
    const lab = x.type === 'N' ? n : x.type === 'W' ? 'É' : x.type;
    return `<div class="setw"><div class="set${x.done ? ' done' : ''}${nw ? ' nw' : ''}" data-ex="${ex.k}" data-k="${x.k}">
      <button class="sn t${x.type}" data-act="setMenu" aria-label="Type de série">${lab}</button>
      ${nw ? '' : stepper('weight', x.weight)}${stepper('reps', x.reps)}
      <button class="chk" data-act="toggleSet" aria-label="Valider la série">${icon('check', 22)}</button></div>
      ${x.pr && x.pr.length ? `<div class="pr">${icon('award', 14)} Record · ${x.pr.join(' · ')}</div>` : ''}</div>`;
  }).join('');
  return `<section class="card ex${ex.ss ? ' ss' : ''}" data-k="${ex.k}">
    <div class="ex-h"><div><div class="ex-n">${esc(ex.name)}</div><div class="ex-m">${esc(ex.muscle)} · repos ${fmtClock(ex.rest)}${ex.ss ? ' · <b>superset ↓</b>' : ''}</div></div><button class="ib" data-act="exMenu" data-k="${ex.k}" aria-label="Options">${icon('more', 22)}</button></div>
    ${ex.note ? `<div class="ex-note">${icon('note', 14)} ${esc(ex.note)}</div>` : ''}
    <div class="sh${nw ? ' nw' : ''}"><span>Série</span>${nw ? '' : '<span>kg</span>'}<span>${unitLabel(ex.unit)}</span><span></span></div>
    ${rows}
    <button class="btn ghost sm block" data-act="addSet" data-k="${ex.k}">${icon('plus', 16)} Ajouter une série</button></section>`;
}

ACT.step = el => {
  const row = el.closest('.set');
  const [ex, set] = findSet(row.dataset.ex, row.dataset.k);
  const f = el.dataset.f, d = +el.dataset.d;
  const step = f === 'weight' ? S.settings.step : (ex.unit === 's' ? 5 : 1);
  set[f] = Math.max(0, round2((+set[f] || 0) + d * step));
  $(`input[data-f="${f}"]`, row).value = fmtN(set[f]);
  if (f === 'weight') S.ui.lastW = set[f];
  persist();
};
BIND.setIn = el => {
  const row = el.closest('.set');
  const [, set] = findSet(row.dataset.ex, row.dataset.k);
  const f = el.dataset.f;
  set[f] = Math.max(0, num(el.value));
  el.value = fmtN(set[f]);
  if (f === 'weight') S.ui.lastW = set[f];
  persist();
};
BIND.sessNote = el => { S.active.notes = el.value; persist(); };

function histSets(exId, excludeSession) {
  const out = [];
  for (const s of S.sessions) {
    if (s.id === excludeSession) continue;
    for (const e of s.exercises) if (e.exId === exId) for (const x of e.sets) if (x.done && x.type !== 'W') out.push(x);
  }
  return out;
}
function prFor(ex, set) {
  if (set.type === 'W' || !(set.reps > 0)) return [];
  const prior = histSets(ex.exId, S.active.id);
  for (const e of S.active.exercises) if (e.exId === ex.exId) for (const x of e.sets) if (x !== set && x.done && x.type !== 'W') prior.push(x);
  if (!prior.length) return [];
  const mw = Math.max(...prior.map(x => x.weight));
  const mv = Math.max(...prior.map(x => x.weight * x.reps));
  const mr = Math.max(0, ...prior.filter(x => x.weight === set.weight).map(x => x.reps));
  const res = [], timed = !!ex.unit;
  if (set.weight > mw) res.push('Charge');
  else if (!timed && set.weight > 0 && set.weight * set.reps > mv) res.push('Volume');
  if (set.weight <= mw && prior.some(x => x.weight === set.weight) && set.reps > mr) res.push(timed ? 'Durée' : 'Reps');
  return res;
}

ACT.toggleSet = async el => {
  const row = el.closest('.set');
  const [ex, set] = findSet(row.dataset.ex, row.dataset.k);
  if (!set.done) {
    set.done = true;
    set.pr = prFor(ex, set);
    if (set.pr.length) { toast('Nouveau record · ' + set.pr.join(', ')); buzz([70, 40, 70]); }
    const allDone = S.active.exercises.every(e => e.sets.every(x => x.done));
    if (!ex.ss && !allDone && ex.rest > 0) startRest(ex.rest, ex.name);
    else buzz(25);
  } else {
    set.done = false;
    delete set.pr;
  }
  await persist();
  render();
};
ACT.addSet = async el => {
  const ex = getEx(el.dataset.k);
  const l = ex.sets[ex.sets.length - 1];
  ex.sets.push({ k: uid(), type: l ? (l.type === 'W' ? 'N' : l.type) : 'N', weight: l ? l.weight : 0, reps: l ? l.reps : defReps(ex.unit), done: false });
  await persist(); render();
};
ACT.setMenu = async el => {
  const row = el.closest('.set');
  const [ex, set] = findSet(row.dataset.ex, row.dataset.k);
  const v = await choose('Type de série', [
    { label: TYPES.N, value: 'N' }, { label: TYPES.W, value: 'W' }, { label: TYPES.D, value: 'D' }, { label: TYPES.F, value: 'F' },
    { label: 'Supprimer la série', icon: 'trash', value: 'del', danger: true }]);
  if (!v) return;
  if (v === 'del') ex.sets = ex.sets.filter(x => x !== set);
  else { set.type = v; if (set.done) set.pr = prFor(ex, set); }
  await persist(); render();
};
ACT.exMenu = async el => {
  const list = S.active.exercises, ex = getEx(el.dataset.k), i = list.indexOf(ex);
  const v = await choose(ex.name, [
    { label: 'Notes', icon: 'note', value: 'note' },
    { label: 'Temps de repos', sub: fmtClock(ex.rest), icon: 'timer', value: 'rest' },
    { label: ex.ss ? 'Retirer le superset' : "Superset avec l'exercice suivant", icon: 'link', value: 'ss' },
    ...(i > 0 ? [{ label: 'Monter', icon: 'up', value: 'up' }] : []),
    ...(i < list.length - 1 ? [{ label: 'Descendre', icon: 'down', value: 'down' }] : []),
    { label: "Supprimer l'exercice", icon: 'trash', value: 'del', danger: true }]);
  if (!v) return;
  if (v === 'note') {
    const r = await form({ title: 'Notes · ' + ex.name, fields: [{ name: 'note', label: 'Notes', type: 'textarea', value: ex.note, placeholder: 'Réglage de la machine, douleur, sensation…' }] });
    if (!r) return; ex.note = r.note.trim();
  } else if (v === 'rest') {
    const r = await form({ title: 'Temps de repos', fields: [{ name: 'rest', label: 'Repos en secondes', inputmode: 'numeric', value: ex.rest, required: true }] });
    if (!r) return; ex.rest = Math.max(0, Math.round(num(r.rest)));
  } else if (v === 'ss') ex.ss = !ex.ss;
  else if (v === 'up') [list[i - 1], list[i]] = [list[i], list[i - 1]];
  else if (v === 'down') [list[i + 1], list[i]] = [list[i], list[i + 1]];
  else if (v === 'del') {
    if (ex.sets.some(x => x.done) && !(await ask({ title: "Supprimer l'exercice ?", msg: 'Les séries validées seront perdues.', ok: 'Supprimer', danger: true }))) return;
    S.active.exercises = list.filter(x => x !== ex);
  }
  await persist(); render();
};
ACT.addEx = async () => {
  const exs = await pickExercises();
  if (!exs.length) return;
  for (const e of exs) {
    const lp = lastPerf(e.id);
    S.active.exercises.push(mkEx({ exId: e.id, name: e.name, muscle: e.muscle, unit: e.unit, rest: S.settings.rest,
      sets: Array.from({ length: (lp && lp.sets) || 3 }, () => ({ type: 'N', weight: (lp && lp.weight) || 0, reps: (lp && lp.reps) || defReps(e.unit) })) }));
  }
  await persist(); render();
};
ACT.sessMenu = async () => {
  const v = await choose(S.active.name, [{ label: 'Renommer la séance', icon: 'edit', value: 'ren' }, { label: 'Abandonner la séance', icon: 'trash', value: 'abort', danger: true }]);
  if (v === 'ren') {
    const r = await form({ title: 'Nom de la séance', fields: [{ name: 'name', label: 'Nom', value: S.active.name, required: true }] });
    if (!r) return; S.active.name = r.name.trim(); await persist(); render();
  } else if (v === 'abort') {
    if (await ask({ title: 'Abandonner la séance ?', msg: 'Rien ne sera enregistré dans l\'historique.', ok: 'Abandonner', cancel: 'Continuer', danger: true })) { await discardActive(); location.replace('#/home'); }
  }
};
ACT.finish = async () => {
  const s = S.active;
  const done = sessDone(s), undone = sessTotal(s) - done;
  if (!done) {
    if (await ask({ title: 'Aucune série validée', msg: 'Abandonner cette séance ?', ok: 'Abandonner', cancel: 'Continuer', danger: true })) { await discardActive(); location.replace('#/home'); }
    return;
  }
  const ok = await ask({ title: 'Terminer la séance ?', msg: undone ? `${undone} série${plu(undone, '')} non validée${plu(undone, '')} ser${undone > 1 ? 'ont' : 'a'} ignorée${plu(undone, '')}.` : 'Bravo, toutes les séries sont validées.', ok: 'Terminer', cancel: 'Continuer' });
  if (!ok) return;
  s.exercises = s.exercises.map(e => ({ ...e, sets: e.sets.filter(x => x.done) })).filter(e => e.sets.length);
  s.endedAt = Date.now();
  delete s.timer;
  await DB.put('sessions', s);
  S.sessions.push(s);
  await discardActive();
  go('#/summary/' + s.id);
};

/* ----- Chrono de repos ----- */
let ac = null;
function beep() {
  if (!S.settings.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    [0, .26, .52].forEach((d, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = i === 2 ? 1046 : 784;
      g.gain.setValueAtTime(.0001, t + d);
      g.gain.exponentialRampToValueAtTime(.35, t + d + .02);
      g.gain.exponentialRampToValueAtTime(.0001, t + d + .22);
      o.connect(g); g.connect(ac.destination);
      o.start(t + d); o.stop(t + d + .24);
    });
  } catch (e) { /* ignore */ }
}
function buzz(p) { if (S.settings.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* ignore */ } }

function startRest(sec, label) {
  S.active.timer = { end: Date.now() + sec * 1000, total: sec, label };
  persist();
  const bar = $('#restbar');
  bar.hidden = false; bar.classList.remove('done');
  tickRest();
}
function hideRest() { const b = $('#restbar'); if (b) b.hidden = true; }
function tickRest() {
  const bar = $('#restbar'), t = S.active && S.active.timer;
  if (!t) { if (!bar.classList.contains('done')) bar.hidden = true; return; }
  const rem = Math.ceil((t.end - Date.now()) / 1000);
  if (rem <= 0) {
    delete S.active.timer; persist();
    bar.hidden = false; bar.classList.add('done');
    $('#rl').textContent = 'Repos terminé'; $('#rt').textContent = '0:00'; $('#rp').style.width = '100%';
    buzz([300, 120, 300, 120, 500]); beep();
    clearTimeout(bar._h); bar._h = setTimeout(() => { bar.classList.remove('done'); if (!(S.active && S.active.timer)) bar.hidden = true; }, 4000);
    return;
  }
  bar.hidden = false; bar.classList.remove('done');
  $('#rl').textContent = t.label || 'Repos';
  $('#rt').textContent = fmtClock(rem);
  $('#rp').style.width = Math.min(100, (1 - rem / t.total) * 100) + '%';
}
ACT.restAdd = el => {
  const t = S.active && S.active.timer; if (!t) return;
  const d = +el.dataset.d * 1000;
  t.end += d; t.total = Math.max(1, t.total + d / 1000); persist(); tickRest();
};
ACT.restSkip = () => { if (S.active) { delete S.active.timer; persist(); } const b = $('#restbar'); b.classList.remove('done'); b.hidden = true; };

function tick() {
  if (S.active) { $$('[data-elapsed]').forEach(el => { el.textContent = hms((Date.now() - S.active.startedAt) / 1000); }); }
  tickRest();
}

/* ----- Écran toujours allumé ----- */
let wl = null;
async function lockScreen() {
  try { if ('wakeLock' in navigator && S.active && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { /* ignore */ }
}
function unlockScreen() { try { if (wl) wl.release(); } catch (e) { /* ignore */ } wl = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (S.active) lockScreen(); tick(); } });

/* ----- Calculateur de disques ----- */
function calcPlates(target, bar, plates) {
  const side = (target - bar) / 2;
  if (side < 0) return { err: 'La charge est inférieure au poids de la barre.' };
  let rem = Math.round(side * 1000) / 1000;
  const out = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    const n = Math.floor(rem / p + 1e-9);
    if (n > 0) { out.push({ p, n }); rem = Math.round((rem - n * p) * 1000) / 1000; }
  }
  return { out, rest: Math.round(rem * 2 * 1000) / 1000 };
}
function plateSvg(out) {
  const hp = p => (p >= 25 ? 84 : p >= 20 ? 78 : p >= 15 ? 68 : p >= 10 ? 58 : p >= 5 ? 46 : p >= 2.5 ? 38 : 30);
  const wp = p => (p >= 10 ? 14 : p >= 2.5 ? 10 : 7);
  let x = 70, g = '';
  for (const { p, n } of out) for (let i = 0; i < n; i++) { const h = hp(p), w = wp(p); g += `<rect x="${x}" y="${50 - h / 2}" width="${w}" height="${h}" rx="3" class="pl"/>`; x += w + 2; }
  const W = Math.max(x + 30, 220);
  return `<svg viewBox="0 0 ${W} 100" class="pbar"><rect x="0" y="46" width="${W}" height="8" rx="3" class="bar"/><rect x="54" y="30" width="10" height="40" rx="3" class="collar"/>${g}</svg>`;
}
ACT.plates = () => plateSheet(S.ui.lastW || 0);
function plateSheet(init) {
  let target = init, bar = S.settings.bar;
  const e = openSheet(`<div class="sheet-h">Calculateur de disques</div><div class="pc">
    <div class="fld"><span>Charge totale (kg)</span><div class="step big"><button data-p="-">−</button><input id="pct" type="text" inputmode="decimal" value="${fmtN(target)}"><button data-p="+">+</button></div></div>
    <div class="fld"><span>Poids de la barre (kg)</span><input id="pcb" type="text" inputmode="decimal" value="${fmtN(bar)}"></div>
    <div id="pcr"></div></div>`);
  const draw = () => {
    const r = calcPlates(target, bar, S.settings.plates);
    let h;
    if (r.err) h = `<div class="empty-s">${r.err}</div>`;
    else if (!r.out.length) h = `<div class="empty-s">Barre seule, sans disque.</div>`;
    else h = `${plateSvg(r.out)}<div class="pchips">${r.out.map(o => `<span><b>${o.n} × ${fmtN(o.p)}</b> kg</span>`).join('')}</div><p class="muted">Disques à mettre <b>de chaque côté</b> de la barre.</p>`;
    if (r.rest > 0) h += `<p class="warn">Charge exacte impossible avec tes disques : il manque ${fmtN(r.rest)} kg (charge réalisable : ${fmtN(round2(target - r.rest))} kg).</p>`;
    $('#pcr', e.el).innerHTML = h;
  };
  $('#pct', e.el).addEventListener('input', ev => { target = num(ev.target.value); draw(); });
  $('#pcb', e.el).addEventListener('input', ev => { bar = num(ev.target.value); draw(); });
  e.el.addEventListener('click', ev => {
    const b = ev.target.closest('[data-p]'); if (!b) return;
    target = Math.max(0, round2(target + (b.dataset.p === '+' ? 1 : -1) * S.settings.step));
    $('#pct', e.el).value = fmtN(target); draw();
  });
  draw();
}

/* ================= Sélecteur d'exercices ================= */
const exRowPick = (x, sel) => `<button class="exr${sel ? ' sel' : ''}" data-x="row" data-id="${x.id}"><div><b>${esc(x.name)}</b><small>${esc(x.muscle)} · ${esc(x.equip)}${x.custom ? ' · Perso' : ''}</small></div><span class="tick">${icon('check', 18)}</span></button>`;

function pickExercises() {
  return new Promise(res => {
    const sel = new Map();
    let q = '', mu = '', eq = '', result = [];
    const e = openSheet(`<div class="pick">
      <div class="pick-h"><button class="ib" data-x="close" aria-label="Fermer">${icon('x', 24)}</button><b>Ajouter des exercices</b><button class="lk" data-x="new">Créer</button></div>
      <div class="search">${icon('search', 18)}<input type="search" id="pq" placeholder="Rechercher un exercice" autocomplete="off"></div>
      ${chipRow('data-x="chip"', 'mu', ['', ...MUSCLES], '', 'Tous')}${chipRow('data-x="chip"', 'eq', ['', ...EQUIPS], '', 'Tout matériel')}
      <div class="plist" id="pl"></div>
      <div class="pick-f"><button class="btn primary block" data-x="ok" id="pok" disabled>Sélectionne des exercices</button></div></div>`, { full: true });
    const el = e.el;
    const drawList = () => {
      const list = filterEx(q, mu, eq);
      $('#pl', el).innerHTML = list.length ? list.map(x => exRowPick(x, sel.has(x.id))).join('') : '<div class="empty-s">Aucun résultat. Tu peux créer cet exercice avec « Créer ».</div>';
    };
    const drawBtn = () => { const b = $('#pok', el); b.disabled = !sel.size; b.textContent = sel.size ? `Ajouter (${sel.size})` : 'Sélectionne des exercices'; };
    e.onClose = () => res(result);
    $('#pq', el).addEventListener('input', ev => { q = ev.target.value; drawList(); });
    el.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-x]'); if (!b) return;
      const x = b.dataset.x;
      if (x === 'close') closeSheet();
      else if (x === 'ok') { result = [...sel.values()]; closeSheet(); }
      else if (x === 'chip') {
        if (b.dataset.k === 'mu') mu = b.dataset.v; else eq = b.dataset.v;
        $$(`.chip[data-k="${b.dataset.k}"]`, el).forEach(c => c.classList.toggle('on', c === b));
        drawList();
      } else if (x === 'row') {
        const ex = EXMAP.get(b.dataset.id);
        if (sel.has(ex.id)) sel.delete(ex.id); else sel.set(ex.id, ex);
        b.classList.toggle('sel'); drawBtn();
      } else if (x === 'new') {
        const ex = await exerciseForm();
        if (ex) { sel.set(ex.id, ex); q = ex.name; mu = ''; eq = ''; $('#pq', el).value = q; $$('.chip', el).forEach(c => c.classList.toggle('on', !c.dataset.v)); drawList(); drawBtn(); }
      }
    });
    drawList();
  });
}

async function exerciseForm(ex) {
  const v = await form({ title: ex ? "Modifier l'exercice" : 'Nouvel exercice', fields: [
    { name: 'name', label: 'Nom', value: ex ? ex.name : '', required: true },
    { name: 'muscle', label: 'Groupe musculaire', type: 'select', options: MUSCLES, value: ex ? ex.muscle : MUSCLES[0] },
    { name: 'equip', label: 'Matériel', type: 'select', options: EQUIPS, value: ex ? ex.equip : EQUIPS[0] },
    { name: 'unit', label: 'Type de saisie', type: 'select', options: [{ v: '', l: 'Poids × répétitions' }, { v: 's', l: 'Durée en secondes (gainage…)' }, { v: 'min', l: 'Durée en minutes (cardio)' }], value: ex ? ex.unit : '' }] });
  if (!v) return null;
  const obj = { id: ex ? ex.id : 'c-' + uid(), name: v.name.trim(), muscle: v.muscle, equip: v.equip, unit: v.unit, custom: true };
  await DB.put('exercises', obj);
  S.custom = [...S.custom.filter(c => c.id !== obj.id), obj];
  rebuildEx();
  return obj;
}

/* ================= Programmes & modèles ================= */
function programsScreen() {
  const act = S.programs.filter(p => !p.archived), arc = S.programs.filter(p => p.archived);
  const card = p => {
    const ts = S.templates.filter(t => t.programId === p.id).sort((a, b) => a.created - b.created);
    return `<section class="card"><div class="card-h"><div><b>${esc(p.name)}</b><small>${ts.length} séance${plu(ts.length, '')}${p.archived ? ' · archivé' : ''}</small></div><button class="ib" data-act="progMenu" data-id="${p.id}" aria-label="Options">${icon('more', 22)}</button></div>
      ${ts.map(t => `<div class="trow"><a class="trow-main" href="#/template/${t.id}"><b>${esc(t.name)}</b><small>${t.day ? esc(t.day) + ' · ' : ''}${t.exercises.length} exercice${plu(t.exercises.length, '')}</small></a>${p.archived ? '' : `<button class="ib play" data-act="startTpl" data-id="${t.id}" aria-label="Lancer">${icon('play', 20)}</button>`}</div>`).join('')}
      <button class="btn ghost sm block" data-act="newTpl" data-id="${p.id}">${icon('plus', 16)} Ajouter une séance</button></section>`;
  };
  let h = head('Programmes', { right: `<button class="ib" data-act="newProgram" aria-label="Nouveau programme">${icon('plus', 24)}</button>` }) + '<div class="pad">';
  h += `<a class="card row link" href="#/library">${icon('dumbbell', 24)}<div><b>Bibliothèque d'exercices</b><small>${allEx().length} exercices · ${S.custom.length} perso</small></div>${icon('chevR', 20)}</a>`;
  if (!act.length && !arc.length) h += `<section class="card empty"><b>Aucun programme</b><p>Un programme regroupe tes séances types (ex. « PPL – hiver 2026 » avec Push, Pull, Legs).</p><button class="btn primary block" data-act="newProgram">Créer mon premier programme</button></section>`;
  h += act.map(card).join('');
  if (arc.length) h += `<h2>Archivés</h2>${arc.map(card).join('')}`;
  return { html: h + '</div>', tab: 'programs' };
}
ACT.newProgram = async () => {
  const v = await form({ title: 'Nouveau programme', fields: [{ name: 'name', label: 'Nom du programme', placeholder: 'Ex. PPL – hiver 2026', required: true }], ok: 'Créer' });
  if (!v) return;
  const p = { id: uid(), name: v.name.trim(), archived: false, created: Date.now() };
  S.programs.push(p); await DB.put('programs', p); render();
};
ACT.progMenu = async el => {
  const p = S.programs.find(x => x.id === el.dataset.id);
  const v = await choose(p.name, [{ label: 'Renommer', icon: 'edit', value: 'ren' }, { label: p.archived ? 'Désarchiver' : 'Archiver', icon: 'archive', value: 'arc' }, { label: 'Dupliquer', icon: 'copy', value: 'dup' }, { label: 'Supprimer', icon: 'trash', value: 'del', danger: true }]);
  if (!v) return;
  if (v === 'ren') {
    const r = await form({ title: 'Renommer', fields: [{ name: 'name', label: 'Nom', value: p.name, required: true }] });
    if (!r) return; p.name = r.name.trim(); await DB.put('programs', p);
  } else if (v === 'arc') { p.archived = !p.archived; await DB.put('programs', p); }
  else if (v === 'dup') {
    const np = { id: uid(), name: p.name + ' (copie)', archived: false, created: Date.now() };
    S.programs.push(np); await DB.put('programs', np);
    for (const t of S.templates.filter(t => t.programId === p.id)) { const nt = JSON.parse(JSON.stringify(t)); nt.id = uid(); nt.programId = np.id; S.templates.push(nt); await DB.put('templates', nt); }
  } else if (v === 'del') {
    if (!(await ask({ title: 'Supprimer ce programme ?', msg: 'Ses séances types seront supprimées. Ton historique n\'est pas touché.', ok: 'Supprimer', danger: true }))) return;
    for (const t of S.templates.filter(t => t.programId === p.id)) await DB.del('templates', t.id);
    S.templates = S.templates.filter(t => t.programId !== p.id);
    S.programs = S.programs.filter(x => x.id !== p.id); await DB.del('programs', p.id);
  }
  render();
};
ACT.newTpl = async el => {
  const v = await form({ title: 'Nouvelle séance type', fields: [
    { name: 'name', label: 'Nom', placeholder: 'Ex. Jambes', required: true },
    { name: 'day', label: 'Jour habituel (facultatif)', type: 'select', options: [{ v: '', l: 'Aucun' }, ...DAYS.map(d => ({ v: d, l: d }))], value: '' }], ok: 'Créer' });
  if (!v) return;
  const t = { id: uid(), programId: el.dataset.id, name: v.name.trim(), day: v.day, exercises: [], created: Date.now() };
  S.templates.push(t); await DB.put('templates', t);
  go('#/template/' + t.id);
};

const curTpl = () => S.templates.find(t => t.id === location.hash.split('/')[2]);
const saveTpl = t => DB.put('templates', t);
const TF = { sets: { min: 1, step: () => 1 }, reps: { min: 1, step: e => (e.unit === 's' ? 5 : 1) }, weight: { min: 0, step: () => S.settings.step }, rest: { min: 0, step: () => 15 } };

function templateScreen(id) {
  const t = S.templates.find(x => x.id === id);
  if (!t) return { html: head('Séance introuvable', { back: true }), tab: 'programs' };
  const field = (i, f, label, val) => `<div class="tf"><label>${label}</label><div class="step"><button data-act="tstep" data-i="${i}" data-f="${f}" data-d="-1" aria-label="Moins">−</button><input type="text" inputmode="decimal" data-bind="tin" data-i="${i}" data-f="${f}" value="${fmtN(val)}"><button data-act="tstep" data-i="${i}" data-f="${f}" data-d="1" aria-label="Plus">+</button></div></div>`;
  const chips = (i, f, opts, cur) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip${String(cur) === String(v) ? ' on' : ''}" data-act="tchip" data-i="${i}" data-f="${f}" data-v="${v}">${l}</button>`).join('')}</div>`;
  let h = head(t.name, { back: true, right: `<button class="ib" data-act="tplMenu" aria-label="Options">${icon('more', 24)}</button>` }) + '<div class="pad">';
  h += `<div class="card"><label class="fld"><span>Nom de la séance</span><input type="text" data-bind="tname" value="${esc(t.name)}"></label>
    <label class="fld"><span>Jour habituel</span><select data-bind="tday"><option value="">Aucun</option>${DAYS.map(d => `<option ${t.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label></div>`;
  if (!t.exercises.length) h += `<div class="empty-s">Aucun exercice. Ajoute-en pour composer ta séance.</div>`;
  h += t.exercises.map((e, i) => `<section class="card tex${e.ss ? ' ss' : ''}">
    <div class="ex-h"><div><div class="ex-n">${esc(e.name)}</div><div class="ex-m">${esc(e.muscle)}${e.ss ? ' · <b>superset ↓</b>' : ''}</div></div><button class="ib" data-act="texMenu" data-i="${i}" aria-label="Options">${icon('more', 22)}</button></div>
    <div class="tgrid">${field(i, 'sets', 'Séries', e.sets)}${field(i, 'reps', unitLabel(e.unit), e.reps)}${e.unit === 'min' ? '' : field(i, 'weight', 'Poids (kg)', e.weight)}${field(i, 'rest', 'Repos (s)', e.rest)}</div>
    <div class="tl2"><label>Séries d'échauffement</label>${chips(i, 'warm', [[0, 'Aucune'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], e.warm || 0)}</div>
    <div class="tl2"><label>Dernière série</label>${chips(i, 'last', [['N', 'Normale'], ['D', 'Dropset'], ['F', "À l'échec"]], e.last || 'N')}</div></section>`).join('');
  h += `<button class="btn ghost block" data-act="tAdd">${icon('plus', 18)} Ajouter des exercices</button>
    <button class="btn primary block" data-act="startTpl" data-id="${t.id}">${icon('play', 18)} Lancer cette séance</button></div>`;
  return { html: h, tab: 'programs' };
}
BIND.tname = el => { const t = curTpl(); t.name = el.value.trim() || t.name; saveTpl(t); };
BIND.tday = el => { const t = curTpl(); t.day = el.value; saveTpl(t); };
BIND.tin = el => {
  const t = curTpl(), e = t.exercises[+el.dataset.i], f = el.dataset.f;
  e[f] = Math.max(TF[f].min, f === 'sets' || f === 'rest' ? Math.round(num(el.value)) : num(el.value));
  el.value = fmtN(e[f]); saveTpl(t);
};
ACT.tstep = el => {
  const t = curTpl(), e = t.exercises[+el.dataset.i], f = el.dataset.f;
  e[f] = Math.max(TF[f].min, round2((+e[f] || 0) + (+el.dataset.d) * TF[f].step(e)));
  $(`input[data-i="${el.dataset.i}"][data-f="${f}"]`).value = fmtN(e[f]); saveTpl(t);
};
ACT.tchip = el => {
  const t = curTpl(), e = t.exercises[+el.dataset.i], f = el.dataset.f;
  e[f] = f === 'warm' ? +el.dataset.v : el.dataset.v;
  saveTpl(t); render();
};
ACT.tAdd = async () => {
  const exs = await pickExercises(); if (!exs.length) return;
  const t = curTpl();
  for (const x of exs) {
    const lp = lastPerf(x.id);
    t.exercises.push({ exId: x.id, name: x.name, muscle: x.muscle, unit: x.unit || '', sets: (lp && lp.sets) || 3, reps: (lp && lp.reps) || defReps(x.unit), weight: (lp && lp.weight) || 0, rest: S.settings.rest, warm: 0, last: 'N', ss: false });
  }
  await saveTpl(t); render();
};
ACT.texMenu = async el => {
  const t = curTpl(), i = +el.dataset.i, e = t.exercises[i];
  const v = await choose(e.name, [
    { label: e.ss ? 'Retirer le superset' : "Superset avec l'exercice suivant", icon: 'link', value: 'ss' },
    ...(i > 0 ? [{ label: 'Monter', icon: 'up', value: 'up' }] : []),
    ...(i < t.exercises.length - 1 ? [{ label: 'Descendre', icon: 'down', value: 'down' }] : []),
    { label: "Retirer de la séance", icon: 'trash', value: 'del', danger: true }]);
  if (!v) return;
  if (v === 'ss') e.ss = !e.ss;
  else if (v === 'up') [t.exercises[i - 1], t.exercises[i]] = [t.exercises[i], t.exercises[i - 1]];
  else if (v === 'down') [t.exercises[i + 1], t.exercises[i]] = [t.exercises[i], t.exercises[i + 1]];
  else if (v === 'del') t.exercises.splice(i, 1);
  await saveTpl(t); render();
};
ACT.tplMenu = async () => {
  const t = curTpl();
  const v = await choose(t.name, [{ label: 'Dupliquer la séance', icon: 'copy', value: 'dup' }, { label: 'Supprimer la séance', icon: 'trash', value: 'del', danger: true }]);
  if (v === 'dup') {
    const nt = JSON.parse(JSON.stringify(t)); nt.id = uid(); nt.name = t.name + ' (copie)'; nt.created = Date.now();
    S.templates.push(nt); await DB.put('templates', nt); toast('Séance dupliquée'); go('#/template/' + nt.id);
  } else if (v === 'del') {
    if (!(await ask({ title: 'Supprimer cette séance type ?', ok: 'Supprimer', danger: true }))) return;
    S.templates = S.templates.filter(x => x.id !== t.id); await DB.del('templates', t.id); location.replace('#/programs');
  }
};

/* ================= Bibliothèque ================= */
const libRow = x => `<div class="exr2"><a class="exr-main" href="#/progress/exo/${x.id}"><b>${esc(x.name)}</b><small>${esc(x.muscle)} · ${esc(x.equip)}${x.custom ? ' · Perso' : ''}</small></a>${x.custom ? `<button class="ib" data-act="editEx" data-id="${x.id}" aria-label="Modifier">${icon('edit', 18)}</button>` : ''}</div>`;
const libList = () => { const l = S.ui.lib, list = filterEx(l.q, l.mu, l.eq); return list.length ? list.map(libRow).join('') : '<div class="empty-s">Aucun exercice trouvé.</div>'; };
function libraryScreen() {
  const l = S.ui.lib || (S.ui.lib = { q: '', mu: '', eq: '' });
  const h = head('Exercices', { back: true, right: `<button class="ib" data-act="newEx" aria-label="Créer un exercice">${icon('plus', 24)}</button>` }) +
    `<div class="pad"><div class="search">${icon('search', 18)}<input type="search" data-live="libq" value="${esc(l.q)}" placeholder="Rechercher parmi ${allEx().length} exercices" autocomplete="off"></div>
    ${chipRow('data-act="libchip"', 'mu', ['', ...MUSCLES], l.mu, 'Tous')}${chipRow('data-act="libchip"', 'eq', ['', ...EQUIPS], l.eq, 'Tout matériel')}
    <p class="muted">Touche un exercice pour voir ta progression.</p><div id="liblist" class="card list">${libList()}</div></div>`;
  return { html: h, tab: 'programs' };
}
LIVE.libq = el => { S.ui.lib.q = el.value; $('#liblist').innerHTML = libList(); };
ACT.libchip = el => {
  S.ui.lib[el.dataset.k] = el.dataset.v;
  $$(`.chip[data-k="${el.dataset.k}"]`).forEach(c => c.classList.toggle('on', c === el));
  $('#liblist').innerHTML = libList();
};
ACT.newEx = async () => {
  const ex = await exerciseForm();
  if (!ex) return;
  S.ui.lib = { q: ex.name, mu: '', eq: '' }; /* on le rend visible : filtres remis à zéro */
  toast('Exercice créé'); render();
};
ACT.editEx = async el => {
  const ex = EXMAP.get(el.dataset.id);
  const v = await choose(ex.name, [{ label: 'Modifier', icon: 'edit', value: 'edit' }, { label: 'Supprimer', icon: 'trash', value: 'del', danger: true }]);
  if (v === 'edit') { if (await exerciseForm(ex)) render(); }
  else if (v === 'del') {
    if (!(await ask({ title: 'Supprimer cet exercice ?', msg: 'Il disparaît de la bibliothèque. Ton historique le conserve.', ok: 'Supprimer', danger: true }))) return;
    await DB.del('exercises', ex.id); S.custom = S.custom.filter(c => c.id !== ex.id); rebuildEx(); render();
  }
};

/* ================= Historique & calendrier ================= */
function calHtml() {
  const c = S.ui.cal, first = new Date(c.y, c.m, 1), start = (first.getDay() + 6) % 7, dim = new Date(c.y, c.m + 1, 0).getDate();
  const days = new Set(S.sessions.map(s => dstr(sessDate(s)))), today = dstr();
  let cells = '<i></i>'.repeat(start);
  for (let d = 1; d <= dim; d++) {
    const k = dstr(new Date(c.y, c.m, d));
    cells += `<button class="day${days.has(k) ? ' has' : ''}${k === today ? ' today' : ''}${c.sel === k ? ' sel' : ''}" data-act="calDay" data-d="${k}">${d}</button>`;
  }
  return `<div class="cal-h"><button class="ib" data-act="calNav" data-d="-1" aria-label="Mois précédent">${icon('chevL', 22)}</button><b>${cap(fmtMonth(first))}</b><button class="ib" data-act="calNav" data-d="1" aria-label="Mois suivant">${icon('chevR', 22)}</button></div>
    <div class="cal-w">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal-g">${cells}</div>`;
}
function historyScreen() {
  const n = new Date();
  const c = S.ui.cal || (S.ui.cal = { y: n.getFullYear(), m: n.getMonth(), sel: null });
  let list = sortedSessions();
  let title;
  if (c.sel) { list = list.filter(s => dstr(sessDate(s)) === c.sel); title = cap(fmtLong(parseD(c.sel))); }
  else { list = list.filter(s => sessDate(s).getFullYear() === c.y && sessDate(s).getMonth() === c.m); title = `${list.length} séance${plu(list.length, '')} en ${fmtMonth(new Date(c.y, c.m, 1))}`; }
  let h = head('Historique') + `<div class="pad"><section class="card cal">${calHtml()}</section><h2>${esc(title)}</h2>`;
  if (!S.sessions.length) h += `<div class="empty-s">Aucune séance enregistrée pour l'instant.<br>Lance ta première séance depuis l'accueil.</div>`;
  else if (!list.length) h += `<div class="empty-s">Pas de séance ${c.sel ? 'ce jour-là' : 'ce mois-ci'}.</div>`;
  else h += `<div class="card list">${list.map(s => `<a class="row" href="#/history/${s.id}"><div><b>${esc(s.name)}</b><small>${esc(cap(fmtLong(sessDate(s))))} · ${fmtDur(sessSecs(s))} · ${sessDone(s)} séries · ${fmtN(Math.round(sessVol(s)))} kg</small></div>${icon('chevR', 20)}</a>`).join('')}</div>`;
  return { html: h + '</div>', tab: 'history' };
}
ACT.calNav = el => { const c = S.ui.cal, d = new Date(c.y, c.m + +el.dataset.d, 1); c.y = d.getFullYear(); c.m = d.getMonth(); c.sel = null; render(); };
ACT.calDay = el => { const c = S.ui.cal; c.sel = c.sel === el.dataset.d ? null : el.dataset.d; render(); };

function exercisesDetail(s) {
  return s.exercises.map(e => {
    let n = 0;
    return `<section class="card"><div class="ex-h"><div><div class="ex-n">${esc(e.name)}</div><div class="ex-m">${esc(e.muscle)}${e.ss ? ' · superset' : ''}</div></div></div>${e.note ? `<div class="ex-note">${icon('note', 14)} ${esc(e.note)}</div>` : ''}
      ${e.sets.filter(x => x.done || s.endedAt === undefined).map(x => { if (x.type !== 'W') n++; const lab = x.type === 'N' ? n : x.type === 'W' ? 'É' : x.type; return `<div class="dl"><span class="sn sm t${x.type}">${lab}</span><span>${setStr(x, e.unit)}</span>${x.pr && x.pr.length ? `<span class="prb">${icon('award', 12)} ${x.pr.join(' · ')}</span>` : ''}</div>`; }).join('')}</section>`;
  }).join('');
}
function detailScreen(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return { html: head('Séance introuvable', { back: true }), tab: 'history' };
  const h = head(s.name, { back: true, sub: esc(cap(fmtLong(sessDate(s)))) + ' · ' + sessDate(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), right: `<button class="ib" data-act="sessActions" data-id="${s.id}" aria-label="Options">${icon('more', 24)}</button>` }) +
    `<div class="pad"><div class="tiles"><div><b>${fmtDur(sessSecs(s))}</b><small>durée</small></div><div><b>${sessDone(s)}</b><small>séries</small></div><div><b>${fmtN(Math.round(sessVol(s)))}</b><small>kg soulevés</small></div></div>
    ${s.notes ? `<div class="card note-card"><b>Notes</b><p>${esc(s.notes)}</p></div>` : ''}${exercisesDetail(s)}
    <button class="btn primary block" data-act="dupSession" data-id="${s.id}">${icon('copy', 18)} Relancer cette séance</button></div>`;
  return { html: h, tab: 'history' };
}
ACT.sessActions = async el => {
  const s = S.sessions.find(x => x.id === el.dataset.id);
  const v = await choose(s.name, [{ label: 'Relancer cette séance', icon: 'copy', value: 'dup' }, { label: 'Enregistrer comme séance type', icon: 'list', value: 'tpl' }, { label: 'Supprimer de l\'historique', icon: 'trash', value: 'del', danger: true }]);
  if (v === 'dup') ACT.dupSession(el);
  else if (v === 'tpl') ACT.sessToTpl(el);
  else if (v === 'del') {
    if (!(await ask({ title: 'Supprimer cette séance ?', msg: 'Elle disparaîtra définitivement de l\'historique et des graphiques.', ok: 'Supprimer', danger: true }))) return;
    S.sessions = S.sessions.filter(x => x.id !== s.id); await DB.del('sessions', s.id); location.replace('#/history');
  }
};
ACT.sessToTpl = async el => {
  const s = S.sessions.find(x => x.id === el.dataset.id);
  const opts = [...S.programs.filter(p => !p.archived).map(p => ({ label: p.name, icon: 'list', value: p.id })), { label: 'Nouveau programme…', icon: 'plus', value: 'new' }];
  const pick = await choose('Ajouter à quel programme ?', opts); if (!pick) return;
  let progId = pick;
  if (pick === 'new') {
    const v = await form({ title: 'Nouveau programme', fields: [{ name: 'name', label: 'Nom du programme', required: true }], ok: 'Créer' }); if (!v) return;
    const p = { id: uid(), name: v.name.trim(), archived: false, created: Date.now() }; S.programs.push(p); await DB.put('programs', p); progId = p.id;
  }
  const v = await form({ title: 'Nom de la séance type', fields: [{ name: 'name', label: 'Nom', value: s.name, required: true }], ok: 'Créer' }); if (!v) return;
  const t = { id: uid(), programId: progId, name: v.name.trim(), day: '', created: Date.now(), exercises: s.exercises.map(e => {
    const ws = e.sets.filter(x => x.type !== 'W'), lt = ws.length ? ws[ws.length - 1].type : 'N';
    return { exId: e.exId, name: e.name, muscle: e.muscle, unit: e.unit || '', sets: Math.max(1, ws.length), reps: (ws[0] && ws[0].reps) || 10, weight: Math.max(0, ...ws.map(x => x.weight)), rest: e.rest || S.settings.rest, warm: Math.min(e.sets.length - ws.length, 4), last: lt === 'D' || lt === 'F' ? lt : 'N', ss: !!e.ss };
  }) };
  S.templates.push(t); await DB.put('templates', t); toast('Séance type créée'); go('#/template/' + t.id);
};

function summaryScreen(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return { html: '', tab: 'home', after: () => location.replace('#/home') };
  const prs = [];
  for (const e of s.exercises) for (const x of e.sets) if (x.pr && x.pr.length) prs.push(`<div class="dl"><span class="prb big">${icon('award', 14)}</span><span><b>${esc(e.name)}</b> · ${setStr(x, e.unit)}</span><span class="muted">${x.pr.join(' · ')}</span></div>`);
  const h = `<header class="top"><div class="tt"><h1>Séance terminée</h1><div class="sub">${esc(s.name)}</div></div></header><div class="pad">
    <div class="tiles"><div><b>${fmtDur(sessSecs(s))}</b><small>durée</small></div><div><b>${sessDone(s)}</b><small>séries</small></div><div><b>${fmtN(Math.round(sessVol(s)))}</b><small>kg soulevés</small></div></div>
    ${prs.length ? `<section class="card"><b>Records battus</b>${prs.join('')}</section>` : ''}
    ${exercisesDetail(s)}
    <a class="btn primary block" href="#/home">Retour à l'accueil</a></div>`;
  return { html: h, tab: 'home' };
}

/* ================= Suivi ================= */
const progSeg = cur => `<div class="seg"><a href="#/progress" class="${cur === 'exo' ? 'on' : ''}">Exercices</a><a href="#/progress/weight" class="${cur === 'weight' ? 'on' : ''}">Poids</a><a href="#/progress/photos" class="${cur === 'photos' ? 'on' : ''}">Photos</a></div>`;

function exStats() {
  const m = new Map();
  for (const s of S.sessions) for (const e of s.exercises) {
    if (!e.sets.some(x => x.done && x.type !== 'W')) continue;
    const r = m.get(e.exId) || { id: e.exId, name: e.name, muscle: e.muscle, n: 0, last: 0 };
    r.n++; r.last = Math.max(r.last, s.startedAt); m.set(e.exId, r);
  }
  return [...m.values()].sort((a, b) => b.last - a.last);
}
const progList = () => {
  const toks = norm(S.ui.pq || '').split(/\s+/).filter(Boolean);
  const l = exStats().filter(x => toks.every(t => norm(x.name + ' ' + x.muscle).includes(t)));
  return l.length ? l.map(x => `<a class="row" href="#/progress/exo/${x.id}"><div><b>${esc(x.name)}</b><small>${esc(x.muscle)} · ${x.n} séance${plu(x.n, '')} · dernière le ${esc(fmtShort(new Date(x.last)))}</small></div>${icon('chevR', 20)}</a>`).join('') : '<div class="empty-s">Aucun exercice avec historique pour le moment.</div>';
};
function progressScreen() {
  const h = head('Progression') + `<div class="pad">${progSeg('exo')}<div class="search">${icon('search', 18)}<input type="search" data-live="progq" value="${esc(S.ui.pq || '')}" placeholder="Rechercher un exercice" autocomplete="off"></div><div id="proglist" class="card list">${progList()}</div></div>`;
  return { html: h, tab: 'progress' };
}
LIVE.progq = el => { S.ui.pq = el.value; $('#proglist').innerHTML = progList(); };

function exoScreen(id) {
  const inst = [];
  for (const s of [...S.sessions].sort((a, b) => a.startedAt - b.startedAt)) for (const e of s.exercises) if (e.exId === id) {
    const ws = e.sets.filter(x => x.done && x.type !== 'W');
    if (ws.length) inst.push({ s, e, ws });
  }
  const ex = EXMAP.get(id);
  const name = (ex && ex.name) || (inst[0] && inst[0].e.name) || 'Exercice';
  const unit = ex ? ex.unit : (inst[0] ? inst[0].e.unit : '') || '';
  let h = head(name, { back: true, sub: esc((ex && ex.muscle) || (inst[0] && inst[0].e.muscle) || '') });
  if (!inst.length) return { html: h + `<div class="pad"><div class="empty-s">Pas encore d'historique pour cet exercice.<br>Fais-le pendant une séance pour voir ta progression ici.</div></div>`, tab: 'progress' };
  const hasW = inst.some(i => i.ws.some(x => x.weight > 0));
  const metrics = unit ? [['r', 'Durée max']] : [['w', 'Charge max'], ['v', 'Volume'], ['r', 'Reps max']];
  if (!S.ui.metric || !metrics.some(m => m[0] === S.ui.metric) || (!hasW && S.ui.metric !== 'r')) S.ui.metric = unit ? 'r' : (hasW ? 'w' : 'r');
  const val = (i, m) => m === 'w' ? Math.max(...i.ws.map(x => x.weight)) : m === 'v' ? i.ws.reduce((a, x) => a + x.weight * x.reps, 0) : Math.max(...i.ws.map(x => x.reps));
  const fv = (v, m) => m === 'r' ? (unit === 's' ? `${fmtN(v)} s` : unit === 'min' ? `${fmtN(v)} min` : `${fmtN(v)} reps`) : `${fmtN(v)} kg`;
  const m = S.ui.metric;
  const pts = inst.map(i => ({ x: i.s.startedAt, y: val(i, m), label: `${fmtFull(sessDate(i.s))} · ${fv(val(i, m), m)}` }));
  let bw = null, bv = null, br = null, bd = null;
  for (const i of inst) for (const x of i.ws) {
    if (!bw || x.weight > bw.x.weight || (x.weight === bw.x.weight && x.reps > bw.x.reps)) bw = { x, s: i.s };
    if (!bv || x.weight * x.reps > bv.x.weight * bv.x.reps) bv = { x, s: i.s };
    if (!br || x.reps > br.x.reps) br = { x, s: i.s };
  }
  const rec = (l, v, r) => `<div><b>${v}</b><small>${l}</small><small class="d">${esc(fmtShort(sessDate(r.s)))}</small></div>`;
  h += `<div class="pad">${metrics.length > 1 ? `<div class="seg">${metrics.map(([k, l]) => `<button data-act="metric" data-v="${k}" class="${k === m ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
    <section class="card">${lineChart(pts, { fmt: v => fmtN(v) })}</section>
    <h2>Records</h2><div class="tiles rec">${unit ? rec('Durée max', fv(br.x.reps, 'r'), br) : (hasW ? rec('Charge max', `${fmtN(bw.x.weight)} kg × ${fmtN(bw.x.reps)}`, bw) + rec('Meilleure série (poids × reps)', `${fmtN(bv.x.weight * bv.x.reps)} kg`, bv) : '') + rec('Reps max', `${fmtN(br.x.reps)}${hasW ? ` à ${fmtN(br.x.weight)} kg` : ''}`, br)}</div>
    <h2>Historique · ${inst.length} séance${plu(inst.length, '')}</h2><div class="card list">${[...inst].reverse().map(i => `<a class="hrow" href="#/history/${i.s.id}"><b>${esc(fmtShort(sessDate(i.s)))}</b><span>${i.ws.slice(0, 6).map(x => setStr(x, unit)).join(' · ')}${i.ws.length > 6 ? ' …' : ''}</span></a>`).join('')}</div></div>`;
  return { html: h, tab: 'progress' };
}
ACT.metric = el => { S.ui.metric = el.dataset.v; render(); };

/* ----- Poids de corps ----- */
function weightScreen() {
  const ws = [...S.weights].sort((a, b) => a.date.localeCompare(b.date));
  let h = head('Progression', {}) + `<div class="pad">${progSeg('weight')}`;
  if (!ws.length) h += `<section class="card empty"><b>Aucune pesée</b><p>Pèse-toi une fois par semaine, dans les mêmes conditions (matin, à jeun) pour suivre ton évolution.</p></section>`;
  else {
    const last = ws[ws.length - 1], first = ws[0];
    const ago = new Date(parseD(last.date).getTime() - 30 * 864e5);
    const ref = [...ws].reverse().find(w => parseD(w.date) <= ago);
    const dl = (a, b) => { const d = round2(a - b); return `${d > 0 ? '+' : ''}${fmtN(d)} kg`; };
    const bmi = S.settings.height ? round2(last.kg / Math.pow(S.settings.height / 100, 2)) : null;
    h += `<div class="tiles"><div><b>${fmtN(last.kg)} kg</b><small>actuel</small></div><div><b>${ws.length > 1 ? dl(last.kg, first.kg) : '—'}</b><small>depuis le début</small></div><div><b>${ref ? dl(last.kg, ref.kg) : '—'}</b><small>sur 30 jours</small></div></div>
      ${bmi ? `<p class="muted">IMC : <b>${fmtN(bmi)}</b> (taille ${S.settings.height} cm)</p>` : `<p class="muted">Renseigne ta taille dans Réglages pour calculer ton IMC.</p>`}
      <section class="card">${lineChart(ws.map(w => ({ x: parseD(w.date).getTime(), y: w.kg, label: `${fmtFull(parseD(w.date))} · ${fmtN(w.kg)} kg` })), {})}</section>
      <h2>Pesées</h2><div class="card list">${[...ws].reverse().map((w, i, arr) => { const prev = arr[i + 1]; return `<button class="row" data-act="weightMenu" data-id="${w.id}"><div><b>${fmtN(w.kg)} kg</b><small>${esc(cap(fmtFull(parseD(w.date))))}</small></div>${prev ? `<span class="tag">${dl(w.kg, prev.kg)}</span>` : ''}${icon('more', 20)}</button>`; }).join('')}</div>`;
  }
  h += `<button class="btn primary block" data-act="addWeight">${icon('plus', 18)} Ajouter une pesée</button></div>`;
  return { html: h, tab: 'progress' };
}
ACT.addWeight = async el => {
  const ex = el && el.dataset && el.dataset.id ? S.weights.find(w => w.id === el.dataset.id) : null;
  const lw = lastWeight();
  const v = await form({ title: ex ? 'Modifier la pesée' : 'Nouvelle pesée', fields: [
    { name: 'date', label: 'Date', type: 'date', value: ex ? ex.date : dstr(), max: dstr(), required: true },
    { name: 'kg', label: 'Poids (kg)', inputmode: 'decimal', value: ex ? fmtN(ex.kg) : (lw ? fmtN(lw.kg) : ''), required: true }] });
  if (!v) return;
  const kg = num(v.kg);
  if (!(kg > 20 && kg < 400)) { toast('Poids invalide'); return; }
  if (ex && ex.id !== v.date) { await DB.del('weights', ex.id); S.weights = S.weights.filter(w => w.id !== ex.id); }
  const w = { id: v.date, date: v.date, kg: round2(kg) };
  S.weights = [...S.weights.filter(x => x.id !== w.id), w];
  await DB.put('weights', w); toast('Pesée enregistrée'); render();
};
ACT.weightMenu = async el => {
  const v = await choose('Pesée', [{ label: 'Modifier', icon: 'edit', value: 'edit' }, { label: 'Supprimer', icon: 'trash', value: 'del', danger: true }]);
  if (v === 'edit') ACT.addWeight(el);
  else if (v === 'del') { S.weights = S.weights.filter(w => w.id !== el.dataset.id); await DB.del('weights', el.dataset.id); render(); }
};

/* ----- Photos ----- */
const URLS = new Map();
const purl = p => { if (!URLS.has(p.id)) URLS.set(p.id, URL.createObjectURL(p.blob)); return URLS.get(p.id); };
const photoSort = (a, b) => a.date.localeCompare(b.date) || a.ts - b.ts;
async function processImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const sc = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
}
async function photosScreen() {
  const photos = (await DB.all('photos')).sort(photoSort).reverse();
  let h = head('Progression') + `<div class="pad">${progSeg('photos')}
    <input type="file" accept="image/*" capture="environment" id="camIn" data-bind="photoIn" hidden><input type="file" accept="image/*" multiple id="galIn" data-bind="photoIn" hidden>
    <div class="btnrow"><button class="btn primary" data-act="pick" data-t="camIn">${icon('camera', 18)} Prendre une photo</button><button class="btn ghost" data-act="pick" data-t="galIn">${icon('image', 18)} Galerie</button></div>`;
  if (photos.length >= 2) h += `<a class="btn ghost block" href="#/timelapse">${icon('play', 18)} Timelapse & avant / après</a>`;
  if (!photos.length) h += `<section class="card empty"><b>Aucune photo</b><p>Prends une photo de face, de profil et de dos, toujours au même endroit et avec la même lumière, pour comparer au fil du temps.</p></section>`;
  else h += `<div class="pgrid">${photos.map(p => `<button class="ph" data-act="photo" data-id="${p.id}"><img src="${purl(p)}" alt="Photo du ${esc(p.date)}" loading="lazy"><span>${esc(fmtShort(parseD(p.date)))}</span></button>`).join('')}</div>`;
  return { html: h + '</div>', tab: 'progress' };
}
ACT.pick = el => $('#' + el.dataset.t).click();
BIND.photoIn = async el => {
  const files = [...el.files]; el.value = '';
  if (!files.length) return;
  toast('Enregistrement…');
  let n = 0;
  for (const f of files) {
    try {
      const blob = await processImage(f);
      const d = el.id === 'camIn' ? new Date() : new Date(f.lastModified || Date.now());
      await DB.put('photos', { id: uid(), date: dstr(d), ts: Date.now() + n, blob, note: '' }); n++;
    } catch (e) { console.error(e); }
  }
  toast(n ? `${n} photo${plu(n, '')} enregistrée${plu(n, '')}` : "Impossible de lire l'image");
  render();
};
ACT.photo = async el => {
  const photos = (await DB.all('photos')).sort(photoSort);
  S.ui.pv = { photos, i: Math.max(0, photos.findIndex(p => p.id === el.dataset.id)) };
  const e = openSheet(`<div class="pv"><div class="pick-h"><button class="ib" data-act="pvClose" aria-label="Fermer">${icon('x', 24)}</button><b id="pvt"></b><button class="ib" data-act="pvMenu" aria-label="Options">${icon('more', 24)}</button></div><div class="pv-img"><img id="pvi" alt=""></div><div class="pv-n"><button class="ib" data-act="pvNav" data-d="-1" aria-label="Précédente">${icon('chevL', 26)}</button><span id="pvnote" class="muted"></span><button class="ib" data-act="pvNav" data-d="1" aria-label="Suivante">${icon('chevR', 26)}</button></div></div>`, { full: true });
  e.onClose = () => render();
  drawPv();
};
function drawPv() {
  const { photos, i } = S.ui.pv, p = photos[i];
  $('#pvt').textContent = cap(fmtFull(parseD(p.date)));
  $('#pvi').src = purl(p);
  $('#pvnote').textContent = p.note || `${i + 1} / ${photos.length}`;
}
ACT.pvClose = () => closeSheet();
ACT.pvNav = el => { const v = S.ui.pv; v.i = (v.i + +el.dataset.d + v.photos.length) % v.photos.length; drawPv(); };
ACT.pvMenu = async () => {
  const v = S.ui.pv, p = v.photos[v.i];
  const a = await choose('Photo', [{ label: 'Modifier la date / la note', icon: 'edit', value: 'edit' }, { label: 'Supprimer la photo', icon: 'trash', value: 'del', danger: true }]);
  if (a === 'edit') {
    const r = await form({ title: 'Photo', fields: [{ name: 'date', label: 'Date', type: 'date', value: p.date, max: dstr(), required: true }, { name: 'note', label: 'Note (facultatif)', value: p.note || '', placeholder: 'Ex. face, 82 kg' }] });
    if (!r) return; p.date = r.date; p.note = r.note.trim(); await DB.put('photos', p); drawPv();
  } else if (a === 'del') {
    if (!(await ask({ title: 'Supprimer cette photo ?', ok: 'Supprimer', danger: true }))) return;
    await DB.del('photos', p.id); URL.revokeObjectURL(URLS.get(p.id)); URLS.delete(p.id);
    v.photos.splice(v.i, 1);
    if (!v.photos.length) { await closeSheet(); return; }
    v.i = Math.min(v.i, v.photos.length - 1); drawPv();
  }
};

/* ----- Timelapse & avant / après ----- */
function stopTL() { if (S.tl && S.tl.timer) { clearInterval(S.tl.timer); S.tl.timer = null; } }
async function timelapseScreen() {
  const photos = (await DB.all('photos')).sort(photoSort);
  const back = head('Évolution', { back: true });
  if (photos.length < 2) return { html: back + `<div class="pad"><div class="empty-s">Il faut au moins 2 photos pour créer un timelapse.</div></div>`, tab: 'progress' };
  const mode = S.ui.tlmode || 'play';
  S.tl = { photos, i: 0, timer: null, speed: S.ui.tlspeed || 600 };
  const seg = `<div class="seg"><button data-act="tlmode" data-v="play" class="${mode === 'play' ? 'on' : ''}">Timelapse</button><button data-act="tlmode" data-v="cmp" class="${mode === 'cmp' ? 'on' : ''}">Avant / Après</button></div>`;
  const opts = sel => photos.map((p, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(fmtFull(parseD(p.date)))}</option>`).join('');
  let h = back + `<div class="pad">${seg}`;
  if (mode === 'play') {
    h += `<div class="tl"><img id="tlimg" src="${purl(photos[0])}" alt=""><div class="tl-date" id="tldate">${esc(fmtFull(parseD(photos[0].date)))}</div></div>
      <input type="range" class="rng" id="tlrange" min="0" max="${photos.length - 1}" value="0" data-live="tlrange" aria-label="Position">
      <div class="btnrow"><button class="btn primary" data-act="tlplay" id="tlplay">${icon('play', 18)} Lecture</button>
      <div class="seg sm">${[['Lent', 1100], ['Normal', 600], ['Rapide', 250]].map(([l, v]) => `<button data-act="tlspeed" data-v="${v}" class="${S.tl.speed === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
  } else {
    const c = S.ui.cmp && S.ui.cmp.a < photos.length && S.ui.cmp.b < photos.length ? S.ui.cmp : (S.ui.cmp = { a: 0, b: photos.length - 1 });
    h += `<div class="cmp"><div><div class="tl"><img id="cmpa" src="${purl(photos[c.a])}" alt=""><div class="tl-date">Avant</div></div><select data-bind="cmpsel" data-s="a">${opts(c.a)}</select></div>
      <div><div class="tl"><img id="cmpb" src="${purl(photos[c.b])}" alt=""><div class="tl-date">Après</div></div><select data-bind="cmpsel" data-s="b">${opts(c.b)}</select></div></div>`;
  }
  return { html: h + '</div>', tab: 'progress' };
}
function showTL(i) {
  const t = S.tl; t.i = i;
  $('#tlimg').src = purl(t.photos[i]);
  $('#tldate').textContent = fmtFull(parseD(t.photos[i].date));
  $('#tlrange').value = i;
}
LIVE.tlrange = el => { stopTL(); setPlayBtn(false); showTL(+el.value); };
function setPlayBtn(on) { const b = $('#tlplay'); if (b) b.innerHTML = `${icon(on ? 'pause' : 'play', 18)} ${on ? 'Pause' : 'Lecture'}`; }
ACT.tlplay = () => {
  const t = S.tl;
  if (t.timer) { stopTL(); setPlayBtn(false); return; }
  if (t.i >= t.photos.length - 1) showTL(0);
  t.timer = setInterval(() => showTL((t.i + 1) % t.photos.length), t.speed);
  setPlayBtn(true);
};
ACT.tlspeed = el => {
  S.ui.tlspeed = S.tl.speed = +el.dataset.v;
  $$('.seg.sm button').forEach(b => b.classList.toggle('on', b === el));
  if (S.tl.timer) { stopTL(); ACT.tlplay(); }
};
ACT.tlmode = el => { S.ui.tlmode = el.dataset.v; render(); };
BIND.cmpsel = el => { S.ui.cmp[el.dataset.s] = +el.value; $('#cmp' + el.dataset.s).src = purl(S.tl.photos[+el.value]); };

/* ================= Réglages & sauvegarde ================= */
function settingsScreen() {
  const st = S.settings;
  const inp = (k, t, v, extra = '') => `<input type="text" ${t === 'num' ? 'inputmode="decimal"' : ''} class="si" data-bind="set" data-k="${k}" data-t="${t}" value="${esc(v)}" ${extra}>`;
  const sel = (k, opts, cur) => `<select class="si" data-bind="set" data-k="${k}" data-t="num">${opts.map(([v, l]) => `<option value="${v}" ${+cur === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const sw = (k, on) => `<label class="sw"><input type="checkbox" data-bind="set" data-k="${k}" data-t="bool" ${on ? 'checked' : ''}><i></i></label>`;
  const row = (t, sub, ctl, wide) => `<div class="srow${wide ? ' wide' : ''}"><div><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>${ctl}</div>`;
  const h = head('Réglages') + `<div class="pad">
    <h2>Profil</h2><div class="card list">
      ${row('Prénom', 'Facultatif', inp('name', 'text', st.name, 'placeholder="—"'))}
      ${row('Taille (cm)', 'Pour calculer ton IMC', inp('height', 'num', st.height || '', 'placeholder="—"'))}</div>
    <h2>Séance</h2><div class="card list">
      ${row('Poids de la barre (kg)', '', inp('bar', 'num', fmtN(st.bar)))}
      ${row('Disques disponibles (kg)', 'Séparés par un espace, ex. 25 20 10 5 2,5 1,25', inp('plates', 'plates', st.plates.map(fmtN).join(' ')), true)}
      ${row('Pas de charge', 'Boutons + et −', sel('step', [[1, '1 kg'], [1.25, '1,25 kg'], [2.5, '2,5 kg'], [5, '5 kg']], st.step))}
      ${row('Repos par défaut (s)', 'Nouveaux exercices', inp('rest', 'num', st.rest))}
      ${row('Vibration', 'Fin du chrono de repos et records', sw('vibrate', st.vibrate))}
      ${row('Son', 'Bip à la fin du repos', sw('sound', st.sound))}</div>
    <h2>Rappels</h2><div class="card list">
      ${row('Pesée', "Rappel sur l'accueil", sel('weighDays', [[5, 'Tous les 5 jours'], [7, 'Chaque semaine'], [10, 'Tous les 10 jours'], [14, 'Toutes les 2 semaines']], st.weighDays), true)}
      ${row('Sauvegarde', "Rappel sur l'accueil", sel('backupWeeks', [[1, 'Chaque semaine'], [2, 'Toutes les 2 semaines'], [4, 'Chaque mois'], [8, 'Tous les 2 mois']], st.backupWeeks), true)}</div>
    <h2>Données</h2><div class="card list">
      <button class="row" data-act="exportData">${icon('download', 22)}<div><b>Exporter mes données</b><small>Séances, programmes, poids · ${st.lastBackup ? 'dernière sauvegarde le ' + esc(fmtShort(new Date(st.lastBackup))) : 'jamais sauvegardé'}</small></div></button>
      <button class="row" data-act="exportPhotos">${icon('image', 22)}<div><b>Exporter mes photos</b><small>Fichier séparé</small></div></button>
      <button class="row" data-act="pick" data-t="impIn">${icon('upload', 22)}<div><b>Importer une sauvegarde</b><small>Données ou photos (.json)</small></div></button>
      <input type="file" accept=".json,application/json" id="impIn" data-bind="importIn" hidden>
      <button class="row danger" data-act="resetAll">${icon('trash', 22)}<div><b>Tout effacer</b><small>Supprime toutes les données de l'app</small></div></button></div>
    <p class="muted center" id="storinfo">Carnet d'entraînement · v1.0</p></div>`;
  return { html: h, tab: 'settings', after: storageInfo };
}
async function storageInfo() {
  const el = $('#storinfo'); if (!el) return;
  let t = 'Carnet d\'entraînement · v1.0';
  try { if (navigator.storage && navigator.storage.persisted) t += (await navigator.storage.persisted()) ? ' · stockage protégé' : ' · stockage non protégé : pense à sauvegarder'; } catch (e) { /* ignore */ }
  el.textContent = t;
}
/* Les disques sont séparés par des espaces (ou ; ou /). La virgule est toujours décimale : « 2,5 » = 2,5 kg. */
const parsePlates = str => [...new Set(String(str).split(/[\s;/]+/).map(x => num(x.replace(/[,.]+$/, ''))).filter(x => x > 0))].sort((a, b) => b - a);
BIND.set = el => {
  const k = el.dataset.k, t = el.dataset.t; let v;
  if (t === 'bool') v = el.checked;
  else if (t === 'num') v = num(el.value);
  else if (t === 'plates') { v = parsePlates(el.value); if (!v.length) v = DEFAULTS.plates; el.value = v.map(fmtN).join(' '); }
  else v = el.value.trim();
  if (k === 'rest') v = Math.max(0, Math.round(v));
  if (k === 'height' && (v < 100 || v > 250)) v = 0;
  S.settings[k] = v; saveSettings();
};

async function saveFile(blob, name) {
  const how = await choose('Enregistrer le fichier', [{ label: 'Dans les Téléchargements', icon: 'download', value: 'dl' }, { label: 'Partager (Drive, e-mail…)', icon: 'upload', value: 'share' }]);
  if (!how) return false;
  if (how === 'share') {
    const f = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
    }
    toast('Partage indisponible, téléchargement…');
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  return true;
}
ACT.exportData = async () => {
  const data = { kind: 'carnet-data', version: 1, exportedAt: Date.now(), settings: S.settings, programs: S.programs, templates: S.templates, sessions: S.sessions, weights: S.weights, exercises: S.custom };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  if (await saveFile(blob, `carnet-sauvegarde-${dstr()}.json`)) { S.settings.lastBackup = Date.now(); saveSettings(); toast('Sauvegarde effectuée'); render(); }
};
ACT.exportPhotos = async () => {
  const photos = await DB.all('photos');
  if (!photos.length) { toast('Aucune photo à exporter'); return; }
  toast('Préparation…');
  const toUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  const out = [];
  for (const p of photos) out.push({ id: p.id, date: p.date, ts: p.ts, note: p.note || '', data: await toUrl(p.blob) });
  const blob = new Blob([JSON.stringify({ kind: 'carnet-photos', version: 1, exportedAt: Date.now(), photos: out })], { type: 'application/json' });
  if (await saveFile(blob, `carnet-photos-${dstr()}.json`)) toast('Photos exportées');
};
BIND.importIn = async el => {
  const file = el.files[0]; el.value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('Fichier illisible'); return; }
  if (data.kind === 'carnet-data') {
    if (!(await ask({ title: 'Remplacer les données ?', msg: 'Toutes les données actuelles (séances, programmes, poids) seront remplacées par celles de la sauvegarde. Les photos ne sont pas touchées.', ok: 'Remplacer', danger: true }))) return;
    for (const [store, arr] of [['programs', data.programs], ['templates', data.templates], ['sessions', data.sessions], ['weights', data.weights], ['exercises', data.exercises]]) {
      await DB.clear(store); for (const o of arr || []) await DB.put(store, o);
    }
    await DB.kvSet('settings', { ...DEFAULTS, ...(data.settings || {}), lastBackup: Date.now() });
    await DB.kvDel('active');
    toast('Sauvegarde restaurée'); setTimeout(() => location.reload(), 700);
  } else if (data.kind === 'carnet-photos') {
    toast('Import des photos…');
    let n = 0;
    for (const p of data.photos || []) { const blob = await (await fetch(p.data)).blob(); await DB.put('photos', { id: p.id, date: p.date, ts: p.ts, note: p.note || '', blob }); n++; }
    toast(`${n} photo${plu(n, '')} importée${plu(n, '')}`);
  } else toast('Fichier non reconnu');
};
ACT.resetAll = async () => {
  if (!(await ask({ title: 'Tout effacer ?', msg: 'Séances, programmes, poids, photos et réglages seront supprimés définitivement. Pense à exporter une sauvegarde avant.', ok: 'Tout effacer', danger: true }))) return;
  for (const s of DB.STORES) await DB.clear(s);
  await DB.kvClear();
  location.hash = '#/home'; location.reload();
};

/* ================= Événements globaux ================= */
function bindGlobal() {
  document.addEventListener('click', e => {
    const hit = e.target.closest('.hit');
    if (hit) { const r = hit.closest('.chart').querySelector('.readout'); r.textContent = hit.dataset.t; return; }
    const el = e.target.closest('[data-act]');
    if (el && ACT[el.dataset.act]) { e.preventDefault(); ACT[el.dataset.act](el, e); }
  });
  document.addEventListener('change', e => { const el = e.target.closest('[data-bind]'); if (el && BIND[el.dataset.bind]) BIND[el.dataset.bind](el, e); });
  document.addEventListener('input', e => { const el = e.target.closest('[data-live]'); if (el && LIVE[el.dataset.live]) LIVE[el.dataset.live](el, e); });
  document.addEventListener('focusin', e => {
    const el = e.target;
    if (el.matches && el.matches('.set input[data-f]')) { S.ui.lastW = el.dataset.f === 'weight' ? num(el.value) : S.ui.lastW; setTimeout(() => el.select && el.select(), 0); }
  });
}

boot().catch(err => { console.error(err); document.body.insertAdjacentHTML('afterbegin', `<p style="padding:24px">Impossible de démarrer l'application : ${esc(err.message)}</p>`); });
