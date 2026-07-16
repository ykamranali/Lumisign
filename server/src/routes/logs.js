import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, loadUser, requirePermission } from '../auth.js';
import { asyncHandler, paginate } from '../utils.js';

const router = Router();
router.use(requireAuth, loadUser);

// GET /api/logs?category=&level=&search=&from=&to=
router.get('/', requirePermission('logs', 'read'), asyncHandler(async (req, res) => {
  const { limit, offset, page } = paginate(req);
  const clauses = [];
  const params = [];
  let i = 1;
  if (req.query.category) { clauses.push(`category=$${i}`); params.push(req.query.category); i++; }
  if (req.query.level) { clauses.push(`level=$${i}`); params.push(req.query.level); i++; }
  if (req.query.search) { clauses.push(`message ILIKE $${i}`); params.push(`%${req.query.search}%`); i++; }
  if (req.query.from) { clauses.push(`created_at >= $${i}`); params.push(req.query.from); i++; }
  if (req.query.to) { clauses.push(`created_at <= $${i}`); params.push(req.query.to); i++; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = await query(`SELECT count(*) FROM logs ${where}`, params);
  const r = await query(`SELECT * FROM logs ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, params);
  res.json({ logs: r.rows, page, limit, total: parseInt(total.rows[0].count, 10) });
}));

// Export as CSV
router.get('/export', requirePermission('logs', 'read'), asyncHandler(async (req, res) => {
  const r = await query('SELECT created_at, level, category, source, message FROM logs ORDER BY created_at DESC LIMIT 10000');
  const header = 'timestamp,level,category,source,message\n';
  const csv = r.rows.map((l) => `"${l.created_at}","${l.level}","${l.category}","${l.source || ''}","${(l.message || '').replace(/"/g, '""')}"`).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="lumisign-logs.csv"');
  res.send(header + csv);
}));

router.delete('/purge', requirePermission('logs', 'write'), asyncHandler(async (req, res) => {
  await query('DELETE FROM logs WHERE created_at < now() - interval \'90 days\'');
  res.json({ ok: true });
}));

export default router;
