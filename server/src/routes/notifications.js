import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, loadUser, requirePermission } from '../auth.js';
import { asyncHandler, paginate } from '../utils.js';

const router = Router();
router.use(requireAuth, loadUser);

router.get('/', requirePermission('notifications', 'read'), asyncHandler(async (req, res) => {
  const { limit, offset, page } = paginate(req);
  const total = await query('SELECT count(*) FROM notifications');
  const r = await query(
    `SELECT n.*, d.name as device_name FROM notifications n LEFT JOIN devices d ON d.id = n.device_id
     ORDER BY n.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]
  );
  const unread = await query('SELECT count(*) FROM notifications WHERE read = FALSE');
  res.json({ notifications: r.rows, page, limit, total: parseInt(total.rows[0].count, 10), unread: parseInt(unread.rows[0].count, 10) });
}));

router.post('/:id/read', requirePermission('notifications', 'read'), asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read=TRUE WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/read-all', requirePermission('notifications', 'read'), asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read=TRUE');
  res.json({ ok: true });
}));

router.delete('/:id', requirePermission('notifications', 'read'), asyncHandler(async (req, res) => {
  await query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
