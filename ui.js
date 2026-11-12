/* Utilitaires d'interface : formats, icônes, feuilles (sheets), graphiques */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
export const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const P = n => String(n).padStart(2, '0');
export const dstr = (d = new Date()) => `${d.getFullYear()}-${P(d.getMonth() + 1)}-${P(d.getDate())}`;
export const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
export const fmtN = n => String(Math.round(n * 100) / 100).replace('.', ',');
export const fmtDur = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${h} h ${P(m)}` : `${m} min`; };
export const fmtClock = sec => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${P(sec % 60)}`; };
const L = (d, o) => new Intl.DateTimeFormat('fr-FR', o).format(d);
export const fmtLong = d => L(d, { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtShort = d => L(d, { day: 'numeric', month: 'short' });
export const fmtFull = d => L(d, { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtMonth = d => L(d, { month: 'long', year: 'numeric' });
export const fmtMonthYr = d => L(d, { month: 'short', year: '2-digit' });

/* ---------- Icônes ---------- */
const IC = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 20h16"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 21l5-3 5 3-1.5-7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
  scale: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9.5a4 4 0 0 1 8 0M12 9.5l2-2"/>',
  note: '<path d="M5 4h14v16H5zM9 9h6M9 13h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'
};
export const icon = (n, s = 22) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ---------- Feuilles modales (liées au bouton Retour d'Android) ---------- */
const sheets = [];
let popResolve = null;

export function openSheet(html, { full = false, className = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'sheet-wrap' + (full ? ' full' : '');
  el.innerHTML = `<div class="sheet-back"></div><div class="sheet ${className}">${html}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const entry = { el, onClose: null };
  sheets.push(entry);
  history.pushState({ sheet: sheets.length }, '');
  $('.sheet-back', el).addEventListener('click', () => closeSheet());
  return entry;
}

export function closeSheet() {
  return new Promise(res => {
    if (!sheets.length) return res();
    popResolve = res;
    history.back();
  });
}

window.addEventListener('popstate', () => {
  if (!sheets.length) return;
  const e = sheets.pop();
  e.el.classList.remove('show');
  setTimeout(() => e.el.remove(), 220);
  if (e.onClose) e.onClose();
  if (popResolve) { const r = popResolve; popResolve = null; r(); }
});

export function ask({ title, msg = '', ok = 'Confirmer', cancel = 'Annuler', danger = false }) {
  return new Promise(res => {
    let ans = false;
    const e = openSheet(`<div class="dlg"><h3>${esc(title)}</h3>${msg ? `<p>${esc(msg)}</p>` : ''}<div class="dlg-b"><button class="btn ghost" data-a="no">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="yes">${esc(ok)}</button></div></div>`, { className: 'center' });
    e.onClose = () => res(ans);
    e.el.addEventListener('click', ev => {
      const b = ev.target.closest('[data-a]');
      if (!b) return;
      ans = b.dataset.a === 'yes';
      closeSheet();
    });
  });
}

export function choose(title, items) {
  return new Promise(res => {
    let v = null;
    const e = openSheet(`<div class="sheet-h">${esc(title)}</div><div class="menu">${items.map((it, i) => `<button class="mi${it.danger ? ' danger' : ''}" data-i="${i}">${it.icon ? icon(it.icon, 20) : ''}<span>${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('')}</div>`);
    e.onClose = () => res(v);
    e.el.addEventListener('click', ev => {
      const b = ev.target.closest('[data-i]');
      if (!b) return;
      v = items[+b.dataset.i].value;
      closeSheet();
    });
  });
}

function fieldHtml(f) {
  const req = f.required ? 'required' : '';
  let inp;
  if (f.type === 'select') {
    inp = `<select name="${f.name}">${f.options.map(o => {
      const v = typeof o === 'string' ? o : o.v, l = typeof o === 'string' ? o : o.l;
      return `<option value="${esc(v)}" ${String(v) === String(f.value ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  } else if (f.type === 'textarea') {
    inp = `<textarea name="${f.name}" rows="4" ${req} placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`;
  } else {
    inp = `<input name="${f.name}" type="${f.type || 'text'}" ${f.inputmode ? `inputmode="${f.inputmode}"` : ''} value="${esc(f.value ?? '')}" ${f.max ? `max="${f.max}"` : ''} ${req} placeholder="${esc(f.placeholder || '')}" autocomplete="off">`;
  }
  return `<label class="fld"><span>${esc(f.label)}</span>${inp}</label>`;
}

export function form({ title, fields, ok = 'Enregistrer' }) {
  return new Promise(res => {
    let out = null;
    const e = openSheet(`<div class="sheet-h">${esc(title)}</div><form class="form">${fields.map(fieldHtml).join('')}<button class="btn primary block" type="submit">${esc(ok)}</button></form>`);
    e.onClose = () => res(out);
    const fm = $('form', e.el);
    fm.addEventListener('submit', ev => {
      ev.preventDefault();
      out = Object.fromEntries(new FormData(fm));
      closeSheet();
    });
    setTimeout(() => { const f = $('input:not([type=date]),textarea', fm); if (f && !f.value) f.focus(); }, 280);
  });
}

export function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Graphique en courbe (SVG) ---------- */
export function lineChart(pts, { h = 210, fmt = v => fmtN(v) } = {}) {
  if (!pts.length) return '<div class="empty-s">Aucune donnée pour le moment</div>';
  const W = 340, H = h, Lp = 40, R = 14, T = 14, B = 28, iw = W - Lp - R, ih = H - T - B;
  let x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  const span = x1 - x0;
  if (x0 === x1) { x0 -= 432e5; x1 += 432e5; }
  let lo = Math.min(...pts.map(p => p.y)), hi = Math.max(...pts.map(p => p.y));
  const allPos = lo >= 0;
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.18; lo -= pad; hi += pad;
  if (allPos && lo < 0) lo = 0;
  const X = x => Lp + (x - x0) / (x1 - x0) * iw;
  const Y = y => T + ih - (y - lo) / (hi - lo) * ih;
  const grid = [0, 1, 2, 3].map(i => {
    const t = lo + (hi - lo) * i / 3;
    return `<line x1="${Lp}" x2="${W - R}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="cg"/><text x="${Lp - 6}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end" class="ct">${fmt(Math.round(t * 10) / 10)}</text>`;
  }).join('');
  const long = span > 300 * 864e5;
  const dl = ms => long ? fmtMonthYr(new Date(ms)) : fmtShort(new Date(ms));
  const xl = pts.length === 1
    ? `<text x="${(Lp + iw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="ct">${dl(pts[0].x)}</text>`
    : [[0, 'start'], [.5, 'middle'], [1, 'end']].map(([f, a]) => `<text x="${(Lp + iw * f).toFixed(1)}" y="${H - 8}" text-anchor="${a}" class="ct">${dl(x0 + (x1 - x0) * f)}</text>`).join('');
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
  const area = `${line}L${X(pts[pts.length - 1].x).toFixed(1)} ${T + ih}L${X(pts[0].x).toFixed(1)} ${T + ih}Z`;
  const dots = pts.length <= 60 ? pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" class="cd"/>`).join('')
    : `<circle cx="${X(pts[pts.length - 1].x).toFixed(1)}" cy="${Y(pts[pts.length - 1].y).toFixed(1)}" r="4" class="cd"/>`;
  const hits = pts.map(p => `<circle class="hit" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="14" data-t="${esc(p.label)}"/>`).join('');
  return `<div class="chart"><div class="readout">${esc(pts[pts.length - 1].label)}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique">${grid}${xl}<path class="ca" d="${area}"/><path class="cl" d="${line}"/>${dots}${hits}</svg></div>`;
}
