const express = require('express'), multer = require('multer');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const app = express();
const DATA = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, 'data');
const FILES = path.join(DATA, 'tracks');
const DB = path.join(DATA, 'tracks.json');
fs.mkdirSync(FILES, { recursive: true });

const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } };
const save = t => fs.writeFileSync(DB, JSON.stringify(t, null, 2));

const auth = (req, res, next) => {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return res.status(500).json({ error: 'ADMIN_PASSWORD is not set on the server.' });
  const a = Buffer.from(req.get('x-admin-password') || ''), b = Buffer.from(pass);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  res.status(401).json({ error: 'Wrong password.' });
};

const upload = multer({
  storage: multer.diskStorage({
    destination: FILES,
    filename: (req, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase())
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, f, cb) => /\.(wav|mp3)$/i.test(f.originalname) ? cb(null, true) : cb(new Error('Only WAV or MP3 files are allowed.'))
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(FILES));

app.get('/api/tracks', (req, res) => res.json(load()));
app.post('/api/login', auth, (req, res) => res.json({ ok: true }));

app.post('/api/tracks', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a WAV or MP3 file.' });
  const tracks = load();
  const t = {
    id: crypto.randomUUID(),
    title: (req.body.title || req.file.originalname).slice(0, 100),
    type: req.body.type === 'SFX' ? 'SFX' : 'Music',
    note: (req.body.note || '').slice(0, 300),
    file: req.file.filename,
    added: new Date().toISOString()
  };
  tracks.unshift(t); save(tracks);
  res.json(t);
});

app.delete('/api/tracks/:id', auth, (req, res) => {
  const tracks = load(), t = tracks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found.' });
  fs.rm(path.join(FILES, t.file), { force: true }, () => {});
  save(tracks.filter(x => x.id !== t.id));
  res.json({ ok: true });
});

app.use((err, req, res, next) => res.status(400).json({ error: err.message }));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Running'));
