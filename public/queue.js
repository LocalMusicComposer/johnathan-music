(() => {
const g = id => document.getElementById(id);
const mk = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const LABEL = { requested: 'New request', awaiting_payment: 'Awaiting payment', in_progress: 'In progress', revisions: 'Revisions', complete: 'Complete', declined: 'Declined' };
const H = () => ({ 'x-admin-password': pw, 'Content-Type': 'application/json' });

function drawForm(open) {
  const b = g('request');
  if (!open) { b.textContent = 'Requests are closed right now. Check back soon.'; return; }
  if (b.querySelector('form')) return;
  b.innerHTML = `<form class="panel" id="rq">
    <input name="name" placeholder="Your name" maxlength="60" required>
    <input name="contact" placeholder="Your Discord or email" maxlength="100" required>
    <select name="type"><option>Music</option><option>SFX</option></select>
    <input name="theme" placeholder="Theme or style (e.g. boss fight, chiptune)" maxlength="100">
    <div class="row">
      <input name="tempo" placeholder="Tempo (BPM)" maxlength="40">
      <input name="length" placeholder="Length" maxlength="40">
    </div>
    <input name="budget" placeholder="Max budget (USD)" maxlength="40">
    <textarea name="idea" placeholder="Describe your idea" maxlength="1500" required></textarea>
    <label class="chk"><input type="checkbox" name="commercial"> Commercial use</label>
    <label class="chk"><input type="checkbox" name="rush"> Rush order (+10%)</label>
    <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button>Send request</button>
  </form><div id="rqmsg" role="status"></div>`;
  g('rq').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target), o = Object.fromEntries(fd);
    o.commercial = !!fd.get('commercial'); o.rush = !!fd.get('rush');
    const m = g('rqmsg'); m.className = ''; m.textContent = 'Sending…';
    const r = await fetch('/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
    const j = await r.json();
    if (r.ok) { e.target.reset(); m.className = 'good'; m.textContent = 'Sent! I’ll reply using the contact you gave.'; }
    else { m.className = 'err'; m.textContent = j.error; }
  };
}

async function loadQueue() {
  const d = await (await fetch('/api/queue')).json();
  const box = g('queue'); box.textContent = '';
  box.append(mk('p', 'qbanner ' + (d.open ? 'on' : 'off'), d.open ? 'Slots open: requests welcome' : 'Queue full: requests closed'));
  if (!d.items.length) box.append(mk('p', null, 'No active commissions right now.'));
  d.items.forEach(i => {
    const r = mk('div', 'panel qrow');
    r.append(mk('strong', null, i.who), mk('span', 'tag', i.type.toUpperCase()), mk('span', 'qs s-' + i.status, LABEL[i.status]));
    box.append(r);
  });
  drawForm(d.open);
}

window.onAdmin = async () => {
  let p = g('owner');
  if (!p) { p = mk('div'); p.id = 'owner'; g('msg').before(p); }
  const r = await fetch('/api/admin/commissions', { headers: H() });
  if (!r.ok) return;
  const d = await r.json(); p.textContent = '';
  p.append(mk('h3', null, 'Commission queue (' + d.items.filter(c => c.status === 'requested').length + ' new)'));
  const t = mk('button', 'ghost', d.open ? 'Close requests' : 'Open requests');
  t.onclick = async () => { await fetch('/api/admin/settings', { method: 'POST', headers: H(), body: JSON.stringify({ open: !d.open }) }); onAdmin(); loadQueue(); };
  p.append(t);
  d.items.forEach(c => {
    const card = mk('div', 'panel ocard');
    card.append(mk('strong', null, c.name + ', ' + c.contact));
    card.append(mk('p', null, [c.type, c.theme, c.tempo, c.length, c.budget && 'Budget ' + c.budget, c.commercial && 'Commercial', c.rush && 'Rush'].filter(Boolean).join(', ')));
    card.append(mk('p', null, c.idea));
    const sel = mk('select');
    Object.keys(LABEL).forEach(k => { const o = mk('option', null, LABEL[k]); o.value = k; if (k === c.status) o.selected = true; sel.append(o); });
    sel.onchange = async () => { await fetch('/api/admin/commissions/' + c.id, { method: 'PATCH', headers: H(), body: JSON.stringify({ status: sel.value }) }); loadQueue(); onAdmin(); };
    const del = mk('button', 'del', 'Delete');
    del.onclick = async () => { if (!confirm('Delete this commission?')) return; await fetch('/api/admin/commissions/' + c.id, { method: 'DELETE', headers: H() }); loadQueue(); onAdmin(); };
    card.append(sel, del); p.append(card);
  });
};

loadQueue();
if (typeof pw !== 'undefined' && pw) window.onAdmin();
})();
