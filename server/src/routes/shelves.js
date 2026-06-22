import express from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../auth.js';
import { nanoid } from 'nanoid';

const router = express.Router();

// Get all shelves (user's own shelves + shared shelves from other users)
router.get('/', authMiddleware, (req, res) => {
  const shelves = db.prepare(`
    SELECT shelves.*, users.username as owner_name, (shelves.user_id = ?) as is_owner
    FROM shelves
    JOIN users ON users.id = shelves.user_id
    WHERE shelves.user_id = ? OR shelves.is_shared = 1
    ORDER BY shelves.created_at ASC
  `).all(req.user.id, req.user.id);

  for (const shelf of shelves) {
    shelf.items = db.prepare(`
      SELECT items.*, shelf_items.sort_order 
      FROM shelf_items 
      JOIN items ON items.id = shelf_items.item_id 
      WHERE shelf_items.shelf_id = ? 
      ORDER BY shelf_items.sort_order ASC
    `).all(shelf.id);
  }
  
  res.json({ shelves });
});

// Create a new shelf
router.post('/', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const id = nanoid(10);
  db.prepare(`
    INSERT INTO shelves (id, user_id, name) VALUES (?, ?, ?)
  `).run(id, req.user.id, name.trim());

  const shelf = db.prepare('SELECT * FROM shelves WHERE id = ?').get(id);
  shelf.items = [];
  res.json({ shelf });
});

// Rename a shelf
router.put('/:id', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

  const info = db.prepare(`
    UPDATE shelves SET name = ? WHERE id = ? AND user_id = ?
  `).run(name.trim(), req.params.id, req.user.id);

  if (info.changes === 0) return res.status(404).json({ error: 'Shelf not found' });
  
  const shelf = db.prepare('SELECT * FROM shelves WHERE id = ?').get(req.params.id);
  res.json({ shelf });
});

// Delete a shelf
router.delete('/:id', authMiddleware, (req, res) => {
  const info = db.prepare(`
    DELETE FROM shelves WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

  if (info.changes === 0) return res.status(404).json({ error: 'Shelf not found' });
  res.json({ ok: true });
});

// Add an item to a shelf
router.post('/:id/items', authMiddleware, (req, res) => {
  const { item_id } = req.body;
  if (!item_id) return res.status(400).json({ error: 'item_id is required' });

  const shelf = db.prepare('SELECT * FROM shelves WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!shelf) return res.status(404).json({ error: 'Shelf not found' });

  // Get max sort order
  const maxOrder = db.prepare(`SELECT MAX(sort_order) as m FROM shelf_items WHERE shelf_id = ?`).get(shelf.id).m || 0;

  try {
    db.prepare(`
      INSERT INTO shelf_items (shelf_id, item_id, sort_order) VALUES (?, ?, ?)
    `).run(shelf.id, item_id, maxOrder + 1);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ error: 'Item is already in this shelf' });
    }
    throw e;
  }

  res.json({ ok: true });
});

// Remove an item from a shelf
router.delete('/:id/items/:itemId', authMiddleware, (req, res) => {
  const shelf = db.prepare('SELECT * FROM shelves WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!shelf) return res.status(404).json({ error: 'Shelf not found' });

  db.prepare(`
    DELETE FROM shelf_items WHERE shelf_id = ? AND item_id = ?
  `).run(shelf.id, req.params.itemId);

  res.json({ ok: true });
});

// Toggle shared status of a shelf
router.post('/:id/toggle-shared', authMiddleware, (req, res) => {
  const shelf = db.prepare('SELECT * FROM shelves WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!shelf) return res.status(404).json({ error: 'Shelf not found' });

  const nextShared = shelf.is_shared ? 0 : 1;
  db.prepare('UPDATE shelves SET is_shared = ? WHERE id = ?').run(nextShared, req.params.id);

  res.json({ ok: true, is_shared: nextShared });
});

export default router;
