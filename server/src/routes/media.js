import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';
import { requireAuth, loadUser, requirePermission } from '../auth.js';
import { asyncHandler, paginate, cryptoRandom } from '../utils.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth, loadUser);

// Ensure storage dirs exist
fs.mkdirSync(config.storage.mediaRoot, { recursive: true });
fs.mkdirSync(config.storage.thumbsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.storage.mediaRoot),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, cryptoRandom(16) + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
});

function detectType(filename, mime) {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  const map = {
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image',
    mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video',
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio',
    pdf: 'pdf', ppt: 'pptx', pptx: 'pptx',
    html: 'html', htm: 'html',
  };
  if (map[ext]) return map[ext];
  if (mime) {
    if (mime.startsWith('image')) return 'image';
    if (mime.startsWith('video')) return 'video';
    if (mime.startsWith('audio')) return 'audio';
  }
  return 'file';
}

// ---- Web / external media (no upload) ----
const webMediaSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['youtube', 'iptv', 'rss', 'weather', 'clock', 'camera', 'webpage', 'html']),
  url: z.string().min(1),
  duration: z.number().optional(),
});

router.post('/web', requirePermission('media', 'write'), asyncHandler(async (req, res) => {
  const parsed = webMediaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const r = await query(
    `INSERT INTO media (name, type, url, duration, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [parsed.data.name, parsed.data.type, parsed.data.url, parsed.data.duration || null, req.user.id]
  );
  res.status(201).json({ media: r.rows[0] });
}));

// ---- Upload ----
router.post('/upload', requirePermission('media', 'write'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const type = detectType(req.file.originalname, req.file.mimetype);
  const name = req.body.name || req.file.originalname;
  const relPath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
  const thumb = type === 'image' ? relPath : null; // images use themselves as thumbnail
  const r = await query(
    `INSERT INTO media (name, type, mime, path, thumbnail, size, duration, uploaded_by, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name, type, req.file.mimetype, relPath, thumb, req.file.size, req.body.duration ? Number(req.body.duration) : null, req.user.id, JSON.stringify({ originalName: req.file.originalname })]
  );
  res.status(201).json({ media: r.rows[0] });
}));

router.get('/', requirePermission('media', 'read'), asyncHandler(async (req, res) => {
  const { limit, offset, page } = paginate(req);
  const params = [];
  let where = '';
  if (req.query.type) { where = 'WHERE type = $1'; params.push(req.query.type); }
  const total = await query(`SELECT count(*) FROM media ${where}`, params);
  const r = await query(`SELECT * FROM media ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, params);
  res.json({ media: r.rows, page, limit, total: parseInt(total.rows[0].count, 10) });
}));

router.get('/:id', requirePermission('media', 'read'), asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM media WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ media: r.rows[0] });
}));

// Stream file (allowed for authenticated users OR enrolled players via device token)
async function fileAccess(req, res, next) {
  const auth = req.headers.authorization || '';
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const devToken = req.headers['x-device-token'] || req.query.token;
  if (jwt) return next();
  if (devToken) {
    const r = await query('SELECT id FROM devices WHERE auth_token=$1 AND approved=TRUE', [devToken]);
    if (r.rowCount) return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

// Stream file
router.get('/:id/file', fileAccess, asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM media WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const m = r.rows[0];
  if (!m.path) return res.status(404).json({ error: 'No file' });
  const full = path.resolve(process.cwd(), m.path);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'File missing on disk' });
  res.setHeader('Content-Type', m.mime || 'application/octet-stream');
  fs.createReadStream(full).pipe(res);
}));

router.get('/:id/thumbnail', fileAccess, asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM media WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  const m = r.rows[0];
  if (m.thumbnail && fs.existsSync(path.resolve(process.cwd(), m.thumbnail))) {
    return res.sendFile(path.resolve(process.cwd(), m.thumbnail));
  }
  // placeholder
  res.status(404).json({ error: 'No thumbnail' });
}));

router.delete('/:id', requirePermission('media', 'write'), asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM media WHERE id=$1', [req.params.id]);
  if (r.rowCount) {
    const m = r.rows[0];
    if (m.path && fs.existsSync(path.resolve(process.cwd(), m.path))) fs.unlinkSync(path.resolve(process.cwd(), m.path));
  }
  await query('DELETE FROM media WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
