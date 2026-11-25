const express = require('express'), multer = require('multer');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));

const DATA = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, 'data');
const FILES = path.join(DATA, 'tracks');
const DB = path.join(DATA, 'tracks.json'), CJ = path.join(DATA, 'commissions.json'), SJ = path.join(DATA, 'settings.json');
fs.mkdirSync(FILES, { recursive: true });

const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const wr = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));

const auth = (req, res, next) => {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set on the server.' });
  const a = Buffer.from(req.get('x-admin-password') || ''), b = Buffer.from(pass);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  res.status(401).json({ error: 'Wrong password.' });
};

const upload = multer({
  storage: multer.diskStorage({ destination: FILES, filename: (req, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, f, cb) => /\.(wav|mp3)$/i.test(f.originalname) ? cb(null, true) : cb(new Error('Only WAV or MP3 files are allowed.'))
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(FILES));

/* tracks */
app.get('/api/tracks', (req, res) => res.json(rd(DB, [])));
app.post('/api/login', auth, (req, res) => res.json({ ok: true }));
app.post('/api/tracks', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a WAV or MP3 file.' });
  const tracks = rd(DB, []);
  const t = { id: crypto.randomUUID(), title: (req.body.title || req.file.originalname).slice(0, 100), type: req.body.type === 'SFX' ? 'SFX' : 'Music', note: (req.body.note || '').slice(0, 300), file: req.file.filename, added: new Date().toISOString() };
  tracks.unshift(t); wr(DB, tracks); res.json(t);
});
app.delete('/api/tracks/:id', auth, (req, res) => {
  const tracks = rd(DB, []), t = tracks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found.' });
  fs.rm(path.join(FILES, t.file), { force: true }, () => {});
  wr(DB, tracks.filter(x => x.id !== t.id)); res.json({ ok: true });
});

/* commissions */
const STATUSES = ['requested', 'awaiting_payment', 'in_progress', 'revisions', 'complete', 'declined'];
const HIDDEN = ['requested', 'declined'], TYPES = ['Music', 'SFX', 'Art'];
const short = n => { n = String(n || '').trim(); return n ? n[0].toUpperCase() + '***' : 'Anon'; };
const clip = (v, n) => String(v || '').trim().slice(0, n);
const isOpen = () => rd(SJ, { open: true }).open !== false;
const hits = new Map();
const limited = ip => { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 36e5); a.push(now); hits.set(ip, a); return a.length > 5; };

async function notify(c) {
  const key = process.env.RESEND_API_KEY, to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return;
  const L = c.type === 'Art' ? ['Piece', 'Characters', 'Body'] : ['Theme', 'Tempo', 'Length'];
  const text = ['Name: ' + c.name, 'Contact: ' + c.contact, 'Type: ' + c.type, L[0] + ': ' + c.theme, L[1] + ': ' + c.tempo, L[2] + ': ' + c.length, 'Budget: ' + c.budget, 'Commercial: ' + (c.commercial ? 'yes' : 'no'), 'Rush: ' + (c.rush ? 'yes' : 'no'), '', 'Idea:', c.idea].join('\n');
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Commissions <onboarding@resend.dev>', to: [to], subject: 'New ' + c.type + ' commission request from ' + c.name, text }) });
    if (!r.ok) console.error('Email failed', r.status, await r.text());
  } catch (e) { console.error('Email error', e.message); }
}

app.get('/api/queue', (req, res) => res.json({ open: isOpen(), items: rd(CJ, []).filter(c => !HIDDEN.includes(c.status)).reverse().map(c => ({ id: c.id, who: short(c.name), type: c.type, status: c.status })) }));

app.post('/api/request', (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });
  if (!isOpen()) return res.status(403).json({ error: 'Requests are closed right now.' });
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many requests. Try again later.' });
  const c = { id: crypto.randomUUID(), status: 'requested', created: new Date().toISOString(), name: clip(b.name, 60), contact: clip(b.contact, 100), type: TYPES.includes(b.type) ? b.type : 'Music',
    theme: clip(b.theme, 100), tempo: clip(b.tempo, 40), length: clip(b.length, 40), budget: clip(b.budget, 40), commercial: !!b.commercial, rush: !!b.rush, idea: clip(b.idea, 1500) };
  if (!c.name || !c.contact || !c.idea) return res.status(400).json({ error: 'Name, contact and idea are required.' });
  const all = rd(CJ, []); all.unshift(c); wr(CJ, all); notify(c); res.json({ ok: true });
});

app.get('/api/admin/commissions', auth, (req, res) => res.json({ open: isOpen(), items: rd(CJ, []) }));
app.patch('/api/admin/commissions/:id', auth, (req, res) => {
  const all = rd(CJ, []), c = all.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found.' });
  if (STATUSES.includes(req.body.status)) c.status = req.body.status;
  wr(CJ, all); res.json(c);
});
app.delete('/api/admin/commissions/:id', auth, (req, res) => { wr(CJ, rd(CJ, []).filter(x => x.id !== req.params.id)); res.json({ ok: true }); });
app.post('/api/admin/settings', auth, (req, res) => { wr(SJ, { open: !!req.body.open }); res.json({ ok: true }); });

app.use((err, req, res, next) => res.status(400).json({ error: err.message }));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Running'));
