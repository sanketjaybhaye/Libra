import express from 'express';
import { db } from '../db/index.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

router.post('/sync/:itemId', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { itemId } = req.params;

  try {
    // 1. Fetch user integration credentials
    const user = db.prepare('SELECT notion_token, notion_database_id FROM users WHERE id = ?').get(userId);
    if (!user?.notion_token || !user?.notion_database_id) {
      return res.status(400).json({ error: 'Please configure your Notion settings in the Settings panel first.' });
    }

    // 2. Fetch item metadata
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
    if (!item) return res.status(404).json({ error: 'Book details not found' });

    // 3. Fetch highlights
    const highlights = db.prepare(`
      SELECT * FROM highlights 
      WHERE user_id = ? AND item_id = ? 
      ORDER BY created_at ASC
    `).all(userId, itemId);

    if (highlights.length === 0) {
      return res.status(400).json({ error: 'You do not have any highlights or notes for this title yet.' });
    }

    // 4. Construct Notion request payload
    const children = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: `Reading Notes: ${item.title}` } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { text: { content: 'Author: ' }, annotations: { bold: true } },
            { text: { content: item.author || 'Unknown' } }
          ]
        }
      },
      {
        object: 'block',
        type: 'divider',
        divider: {}
      }
    ];

    // Add highlights
    highlights.forEach(hl => {
      children.push({
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: [{ text: { content: hl.text } }]
        }
      });
      if (hl.note) {
        children.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { text: { content: '↳ Note: ' }, annotations: { bold: true, italic: true } },
              { text: { content: hl.note } }
            ]
          }
        });
      }
      // Add visual space
      children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [] }
      });
    });

    // 5. Send POST request to Notion API
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.notion_token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: user.notion_database_id },
        properties: {
          Name: {
            title: [
              { text: { content: item.title } }
            ]
          }
        },
        children: children.slice(0, 100) // Notion block child limit is 100 per request
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Notion sync request failed');
    }

    res.json({ ok: true, url: data.url });

  } catch (err) {
    console.error('Notion Sync failed:', err);
    res.status(500).json({ error: err.message || 'Failed to sync highlights to Notion' });
  }
});

export default router;
