import express from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../auth.js';
import { nanoid } from 'nanoid';

const router = express.Router();

// Get recent highlights across all items for the user
router.get('/recent', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit || 5, 10);
  const highlights = db.prepare(`
    SELECT highlights.*, items.title as item_title
    FROM highlights
    JOIN items ON items.id = highlights.item_id
    WHERE highlights.user_id = ?
    ORDER BY highlights.created_at DESC
    LIMIT ?
  `).all(req.user.id, limit);

  res.json({ highlights });
});

// Get highlights for a specific item
router.get('/:itemId', authMiddleware, (req, res) => {
  const highlights = db.prepare(`
    SELECT * FROM highlights 
    WHERE user_id = ? AND item_id = ? 
    ORDER BY created_at ASC
  `).all(req.user.id, req.params.itemId);

  res.json({ highlights });
});

// Create a new highlight
router.post('/', authMiddleware, (req, res) => {
  const { item_id, location_cfi, text, note, color } = req.body;
  if (!item_id || !location_cfi || !text) {
    return res.status(400).json({ error: 'item_id, location_cfi, and text are required' });
  }

  const id = nanoid(10);
  const finalColor = color || '#c98a3e'; // Default to accent color

  db.prepare(`
    INSERT INTO highlights (id, user_id, item_id, location_cfi, text, note, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, item_id, location_cfi, text, note || null, finalColor);

  const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(id);
  res.json({ highlight });
});

// Update a highlight (e.g. adding a note or changing color)
router.put('/:id', authMiddleware, (req, res) => {
  const { note, color } = req.body;

  const info = db.prepare(`
    UPDATE highlights SET note = ?, color = ? WHERE id = ? AND user_id = ?
  `).run(note || null, color || '#c98a3e', req.params.id, req.user.id);

  if (info.changes === 0) return res.status(404).json({ error: 'Highlight not found' });
  
  const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(req.params.id);
  res.json({ highlight });
});

// Delete a highlight
router.delete('/:id', authMiddleware, (req, res) => {
  const info = db.prepare(`
    DELETE FROM highlights WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

  if (info.changes === 0) return res.status(404).json({ error: 'Highlight not found' });
  res.json({ ok: true });
});

export default router;
