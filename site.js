(() => {
const $ = id => document.getElementById(id);
const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
let pw = ''; try { pw = sessionStorage.getItem('pw') || ''; } catch {}
const H = () => ({ 'x-admin-password': pw, 'Content-Type': 'application/json' });
const LABEL = { requested: 'New request', awaiting_payment: 'Awaiting payment', in_progress: 'In progress', revisions: 'Revisions', complete: 'Complete', declined: 'Declined' };
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const cur = document.body.dataset.page;

document.body.insertAdjacentHTML('afterbegin', '<canvas id="stars" aria-hidden="true"></canvas><nav class="nav"><a href="/" data-p="home">Home</a><a href="/music.html" data-p="music">Music</a><a href="/art.html" data-p="art">Art</a></nav>');
document.body.insertAdjacentHTML('beforeend', '<footer class="foot"><a href="/terms-music.html">Music terms</a><a href="/terms-art.html">Art terms</a><a href="/owner.html">Owner</a></footer>');
document.querySelectorAll('.nav a').forEach(a => { if (a.dataset.p === cur) a.setAttribute('aria-current', 'page'); });

/* stars */
(() => {
  const c = $('stars'), x = c.getContext('2d'); let S = [];
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const size = () => { c.width = innerWidth; c.height = innerHeight; S = Array.from({ length: Math.min(160, Math.floor(c.width * c.height / 9000)) }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 1.2 + .2, p: Math.random() * 6.28, s: Math.random() * .02 + .005 })); };
  const draw = () => { x.clearRect(0, 0, c.width, c.height); for (const s of S) { s.p += s.s; x.globalAlpha = .35 + .45 * Math.sin(s.p); x.fillStyle = '#cfe8ff'; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.28); x.fill(); } if (!calm) requestAnimationFrame(draw); };
  addEventListener('resize', () => { size(); if (calm) draw(); }); size(); draw();
})();

/* copy discord */
const cb = $('copyBtn');
if (cb) cb.onclick = async () => { try { await navigator.clipboard.writeText('local_music_composer'); cb.textContent = 'Copied'; } catch { cb.textContent = 'Copy failed'; } setTimeout(() => cb.textContent = 'Copy', 2000); };

/* audio player */
let current = null;
function player(src, card) {
  const wrap = mk('div', 'player'), a = new Audio(); a.preload = 'none'; a.src = src;
  const btn = mk('button', 'play', '▶'); btn.setAttribute('aria-label', 'Play or pause');
  const bar = mk('div', 'bar'), fill = mk('div', 'fill'); bar.append(fill);
  const time = mk('span', 'time', '0:00');
  btn.onclick = () => a.paused ? a.play() : a.pause();
  a.addEventListener('play', () => { if (current && current !== a) current.pause(); current = a; btn.textContent = '❚❚'; card.classList.add('on'); });
  const stop = () => { btn.textContent = '▶'; card.classList.remove('on'); };
  a.addEventListener('pause', stop); a.addEventListener('ended', stop);
  a.addEventListener('timeupdate', () => { fill.style.width = (a.currentTime / (a.duration || 1) * 100) + '%'; time.textContent = fmt(a.currentTime) + (a.duration ? ' / ' + fmt(a.duration) : ''); });
  bar.onclick = e => { if (a.duration) { const r = bar.getBoundingClientRect(); a.currentTime = (e.clientX - r.left) / r.width * a.duration; } };
  wrap.append(btn, bar, time); return wrap;
}

async function loadTracks() {
  const list = $('tracks'); if (!list) return;
  const tracks = await (await fetch('/api/tracks')).json(); list.textContent = '';
  if (!tracks.length) return list.append(mk('p', null, 'No tracks yet. Check back soon.'));
  tracks.forEach(t => {
    const d = mk('div', 'panel track'), top = mk('div', 'top');
    top.append(mk('strong', null, t.title), mk('span', 'tag', t.type.toUpperCase()));
    d.append(top, player('/files/' + encodeURIComponent(t.file), d));
    if (t.note) d.append(mk('p', 'note', t.note));
    if (pw) { const b = mk('button', 'del', 'Delete'); b.onclick = async () => { if (!confirm('Delete “' + t.title + '”?')) return; const r = await fetch('/api/tracks/' + t.id, { method: 'DELETE', headers: H() }); if (r.ok) loadTracks(); }; d.append(b); }
    list.append(d);
  });
}

/* request form */
const FORMS = {
  music: `<input name="theme" placeholder="Theme or style (e.g. boss fight, chiptune)" maxlength="100"><div class="row"><input name="tempo" placeholder="Tempo (BPM)" maxlength="40"><input name="length" placeholder="Length" maxlength="40"></div>`,
  art: `<select name="theme"><option>Flat color</option><option>Slight render</option><option>Full render</option></select><div class="row"><input name="tempo" placeholder="Number of characters" maxlength="40"><select name="length"><option>Full body</option><option>Half body</option></select></div>`
};
function drawForm(open) {
  const b = $('request'); if (!b) return;
  if (!open) { b.textContent = 'Requests are closed right now. Check back soon.'; return; }
  if (b.querySelector('form')) return;
  const kind = b.dataset.kind;
  b.innerHTML = `<form class="panel" id="rq"><input name="name" placeholder="Your name" maxlength="60" required><input name="contact" placeholder="Your Discord or email" maxlength="100" required>
    ${kind === 'music' ? '<select name="type"><option>Music</option><option>SFX</option></select>' : '<input type="hidden" name="type" value="Art">'}
    ${FORMS[kind]}<input name="budget" placeholder="Max budget (USD)" maxlength="40">
    <textarea name="idea" placeholder="${kind === 'art' ? 'Describe your character, pose and background. Add a reference link if you have one.' : 'Describe your idea'}" maxlength="1500" required></textarea>
    <label class="chk"><input type="checkbox" name="commercial"> Commercial use</label><label class="chk"><input type="checkbox" name="rush"> Rush order (+10%)</label>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button>Send request</button></form><div class="msg" id="rqmsg" role="status"></div>`;
  $('rq').onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target), o = Object.fromEntries(fd); o.commercial = !!fd.get('commercial'); o.rush = !!fd.get('rush');
    const m = $('rqmsg'); m.className = 'msg'; m.textContent = 'Sending…';
    const r = await fetch('/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }), j = await r.json();
    if (r.ok) { e.target.reset(); m.className = 'msg good'; m.textContent = 'Sent! I’ll reply using the contact you gave.'; } else { m.className = 'msg err'; m.textContent = j.error; }
  };
}

async function loadQueue() {
  const box = $('queue'), d = await (await fetch('/api/queue')).json();
  if (box) {
    const f = box.dataset.filter || 'all'; box.textContent = '';
    box.append(mk('p', 'qbanner ' + (d.open ? 'on' : 'off'), d.open ? 'Slots open: requests welcome' : 'Queue full: requests closed'));
    const items = d.items.filter(i => f === 'all' || (f === 'art') === (i.type === 'Art'));
    if (!items.length) box.append(mk('p', null, 'No active commissions right now.'));
    items.forEach(i => { const r = mk('div', 'panel qrow'); r.append(mk('strong', null, i.who), mk('span', 'tag', i.type.toUpperCase()), mk('span', 'qs s-' + i.status, LABEL[i.status])); box.append(r); });
  }
  drawForm(d.open);
}

/* owner page */
async function owner() {
  const root = $('owner'); if (!root) return; root.textContent = '';
  const say = (t, c) => { const m = $('omsg'); if (m) { m.textContent = t; m.className = 'msg ' + (c || ''); } };
  if (!pw) {
    root.innerHTML = '<form id="lf"><input type="password" id="pw" placeholder="Admin password" autocomplete="current-password" required><button>Log in</button></form><div class="msg err" id="omsg"></div>';
    $('lf').onsubmit = async e => { e.preventDefault(); const p = $('pw').value; const r = await fetch('/api/login', { method: 'POST', headers: { 'x-admin-password': p } });
      if (r.ok) { pw = p; try { sessionStorage.setItem('pw', p); } catch {} owner(); } else say((await r.json()).error, 'err'); };
    return;
  }
  const out = mk('button', 'ghost', 'Log out'); out.onclick = () => { try { sessionStorage.removeItem('pw'); } catch {} pw = ''; owner(); };
  root.append(out, mk('h2', null, 'UPLOAD A TRACK'));
  const up = mk('form'); up.innerHTML = '<input id="title" placeholder="Title" maxlength="100" required><select id="type"><option>Music</option><option>SFX</option></select><input id="note" placeholder="Short note (optional)" maxlength="300"><input type="file" id="file" accept=".wav,.mp3,audio/wav,audio/mpeg" required><button>Upload track</button>';
  up.onsubmit = async e => { e.preventDefault(); const f = new FormData(); f.append('title', $('title').value); f.append('type', $('type').value); f.append('note', $('note').value); f.append('file', $('file').files[0]);
    say('Uploading…'); const r = await fetch('/api/tracks', { method: 'POST', headers: { 'x-admin-password': pw }, body: f }), j = await r.json();
    if (r.ok) { say('Uploaded “' + j.title + '”.', 'good'); up.reset(); } else say(j.error, 'err'); };
  root.append(up, mk('div', 'msg')); root.lastChild.id = 'omsg';
  const r = await fetch('/api/admin/commissions', { headers: H() }); if (!r.ok) return;
  const d = await r.json();
  root.append(mk('h2', null, 'COMMISSIONS (' + d.items.filter(c => c.status === 'requested').length + ' NEW)'));
  const t = mk('button', 'ghost', d.open ? 'Close requests' : 'Open requests');
  t.onclick = async () => { await fetch('/api/admin/settings', { method: 'POST', headers: H(), body: JSON.stringify({ open: !d.open }) }); owner(); }; root.append(t);
  d.items.forEach(c => {
    const card = mk('div', 'panel ocard');
    card.append(mk('strong', null, c.name + ', ' + c.contact), mk('p', null, [c.type, c.theme, c.tempo, c.length, c.budget && 'Budget ' + c.budget, c.commercial && 'Commercial', c.rush && 'Rush'].filter(Boolean).join(', ')), mk('p', null, c.idea));
    const sel = mk('select'); Object.keys(LABEL).forEach(k => { const o = mk('option', null, LABEL[k]); o.value = k; if (k === c.status) o.selected = true; sel.append(o); });
    sel.onchange = async () => { await fetch('/api/admin/commissions/' + c.id, { method: 'PATCH', headers: H(), body: JSON.stringify({ status: sel.value }) }); owner(); };
    const del = mk('button', 'del', 'Delete'); del.onclick = async () => { if (!confirm('Delete this commission?')) return; await fetch('/api/admin/commissions/' + c.id, { method: 'DELETE', headers: H() }); owner(); };
    card.append(sel, del); root.append(card);
  });
}

loadTracks(); loadQueue(); owner();
})();
