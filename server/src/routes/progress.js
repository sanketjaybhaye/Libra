import express from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

router.put('/:itemId', authMiddleware, (req, res) => {
  const { location, percent, status } = req.body;
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'This title was not found' });

  const clampedPercent = Math.max(0, Math.min(100, percent ?? 0));
  let resolvedStatus = status;
  if (!resolvedStatus) {
    resolvedStatus = clampedPercent >= 99 ? 'finished' : clampedPercent > 0 ? 'reading' : 'unread';
  }

  // Calculate reading history diff
  try {
    const prevProgress = db.prepare('SELECT percent FROM progress WHERE user_id = ? AND item_id = ?').get(req.user.id, req.params.itemId);
    const prevPercent = prevProgress ? prevProgress.percent : 0;
    const diffPercent = clampedPercent - prevPercent;
    if (diffPercent > 0) {
      const book = db.prepare('SELECT page_count FROM items WHERE id = ?').get(req.params.itemId);
      const totalPages = book && book.page_count ? book.page_count : 100;
      const pagesRead = Math.max(1, Math.round((diffPercent / 100) * totalPages));
      const today = new Date().toISOString().split('T')[0];
      
      db.prepare(`
        INSERT INTO reading_history (user_id, item_id, pages_read, read_date)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, item_id, read_date) DO UPDATE SET
          pages_read = pages_read + excluded.pages_read
      `).run(req.user.id, req.params.itemId, pagesRead, today);
    }
  } catch (err) {
    console.error('Failed to log reading history:', err);
  }

  const finishedAt = resolvedStatus === 'finished' ? new Date().toISOString() : null;

  db.prepare(`
    INSERT INTO progress (user_id, item_id, location, percent, status, updated_at, finished_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET
      location = excluded.location,
      percent = excluded.percent,
      status = excluded.status,
      updated_at = datetime('now'),
      finished_at = COALESCE(progress.finished_at, excluded.finished_at)
  `).run(req.user.id, req.params.itemId, location ?? null, clampedPercent, resolvedStatus, finishedAt);

  res.json({ ok: true });
});

router.get('/analytics', authMiddleware, (req, res) => {
  const finishedCount = db.prepare(`SELECT COUNT(*) as c FROM progress WHERE user_id = ? AND status = 'finished'`).get(req.user.id).c;
  const readingCount = db.prepare(`SELECT COUNT(*) as c FROM progress WHERE user_id = ? AND status = 'reading'`).get(req.user.id).c;
  const avgPercent = db.prepare(`SELECT AVG(percent) as a FROM progress WHERE user_id = ? AND status = 'reading'`).get(req.user.id).a || 0;
  
  // Just a simple analytics payload
  res.json({
    totalFinished: finishedCount,
    currentlyReading: readingCount,
    averageReadingProgress: Math.round(avgPercent)
  });
});

router.get('/continue-reading', authMiddleware, (req, res) => {
  const items = db.prepare(`
    SELECT items.*, progress.percent as my_percent, progress.status as my_status, progress.updated_at as last_read
    FROM progress
    JOIN items ON items.id = progress.item_id
    WHERE progress.user_id = ? AND progress.status = 'reading'
    ORDER BY progress.updated_at DESC
    LIMIT 12
  `).all(req.user.id);
  res.json({ items });
});

router.post('/log-time', authMiddleware, (req, res) => {
  const { itemId, minutes } = req.body;
  if (!itemId || minutes === undefined) {
    return res.status(400).json({ error: 'itemId and minutes are required' });
  }

  const mins = parseInt(minutes, 10);
  if (isNaN(mins) || mins < 0) {
    return res.status(400).json({ error: 'minutes must be a non-negative integer' });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    db.prepare(`
      INSERT INTO reading_history (user_id, item_id, pages_read, minutes_read, read_date)
      VALUES (?, ?, 0, ?, ?)
      ON CONFLICT(user_id, item_id, read_date) DO UPDATE SET
        minutes_read = minutes_read + excluded.minutes_read
    `).run(req.user.id, itemId, mins, today);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to log reading time:', err);
    res.status(500).json({ error: 'Failed to log reading time' });
  }
});

router.post('/:itemId/favorite', authMiddleware, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, item_id) VALUES (?, ?)').run(req.user.id, req.params.itemId);
  res.json({ ok: true });
});

router.delete('/:itemId/favorite', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND item_id = ?').run(req.user.id, req.params.itemId);
  res.json({ ok: true });
});

export default router;
