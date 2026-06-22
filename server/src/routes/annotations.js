import express from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../auth.js';
import { nanoid } from 'nanoid';

const router = express.Router();

// Get annotation strokes for a page in a specific item
router.get('/:itemId/:pageIndex', authMiddleware, (req, res) => {
  const { itemId, pageIndex } = req.params;
  const pageIdx = parseInt(pageIndex, 10);
  if (isNaN(pageIdx)) {
    return res.status(400).json({ error: 'pageIndex must be a valid integer' });
  }

  try {
    const row = db.prepare(`
      SELECT strokes_json FROM item_annotations
      WHERE user_id = ? AND item_id = ? AND page_index = ?
    `).get(req.user.id, itemId, pageIdx);

    res.json({ strokes: row ? JSON.parse(row.strokes_json) : [] });
  } catch (err) {
    console.error('Failed to get annotations:', err);
    res.status(500).json({ error: 'Failed to retrieve annotations' });
  }
});

// Save annotation strokes for a page in a specific item
router.post('/:itemId/:pageIndex', authMiddleware, (req, res) => {
  const { itemId, pageIndex } = req.params;
  const { strokes } = req.body;
  const pageIdx = parseInt(pageIndex, 10);
  if (isNaN(pageIdx)) {
    return res.status(400).json({ error: 'pageIndex must be a valid integer' });
  }
  if (!Array.isArray(strokes)) {
    return res.status(400).json({ error: 'strokes must be an array' });
  }

  const id = nanoid();
  const strokesStr = JSON.stringify(strokes);

  try {
    db.prepare(`
      INSERT INTO item_annotations (id, item_id, user_id, page_index, strokes_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(item_id, user_id, page_index) DO UPDATE SET
        strokes_json = excluded.strokes_json,
        created_at = datetime('now')
    `).run(id, itemId, req.user.id, pageIdx, strokesStr);

    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save annotations:', err);
    res.status(500).json({ error: 'Failed to save annotations' });
  }
});

export default router;
