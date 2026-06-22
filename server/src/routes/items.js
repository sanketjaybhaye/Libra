import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { db, UPLOADS_DIR } from '../db/index.js';
import { authMiddleware } from '../auth.js';
import { parseEpub } from '../parsers/epub.js';
import { parseCbz, parseCbr, extractComicPage, getComicPageList } from '../parsers/comic.js';
import { parsePdf } from '../parsers/pdf.js';

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS_DIR, 'books')),
    filename: (req, file, cb) => {
      const id = nanoid(12);
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${id}${ext}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB ceiling, generous for scanned PDFs/comics
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.epub', '.pdf', '.cbz', '.cbr', '.mobi'].includes(ext)) cb(null, true);
    else cb(new Error('Unsupported file type. Use EPUB, PDF, CBZ, or CBR.'));
  },
});

const uploadCover = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS_DIR, 'covers')),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const fileId = nanoid(8);
      cb(null, `${req.params.id}-${fileId}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) cb(null, true);
    else cb(new Error('Unsupported image type. Use JPG, PNG, or WEBP.'));
  },
});

function formatFromExt(ext) {
  return ext.replace('.', '');
}

function kindFromFormat(format) {
  return ['cbz', 'cbr'].includes(format) ? 'comic' : 'book';
}

function titleFromFilename(filename) {
  return path.basename(filename, path.extname(filename)).replace(/[_\-]+/g, ' ').trim();
}

function cleanTitleForQuery(title) {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/WeLib\.org|epub|pdf|mobi|cbz|cbr/gi, '')
    .replace(/\s\s+/g, ' ')
    .trim();
}

async function fetchGoogleBooksMetadata(title) {
  try {
    const cleanQ = cleanTitleForQuery(title);
    if (!cleanQ) return null;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(cleanQ)}&maxResults=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

    const info = data.items[0].volumeInfo;
    const tags = [];
    if (Array.isArray(info.categories)) {
      info.categories.forEach(c => {
        c.split('/').forEach(part => {
          const trimmed = part.trim();
          if (trimmed && !tags.includes(trimmed)) tags.push(trimmed);
        });
      });
    }

    const meta = {
      title: info.title || title,
      author: info.authors ? info.authors.join(', ') : null,
      description: info.description || null,
      tags: tags
    };

    if (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) {
      meta.coverUrl = (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail).replace('http://', 'https://');
    }
    return meta;
  } catch (err) {
    console.error('Google Books metadata fetch failed:', err);
    return null;
  }
}

async function fetchiTunesMetadata(title) {
  try {
    const cleanQ = cleanTitleForQuery(title);
    if (!cleanQ) return null;
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&entity=ebook&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const item = data.results[0];
    let coverUrl = item.artworkUrl100 || null;
    if (coverUrl) {
      coverUrl = coverUrl.replace(/100x100bb\.jpg$/, '600x600bb.jpg');
    }

    const cleanDescription = item.description 
      ? item.description.replace(/<[^>]*>/g, '').trim()
      : null;

    return {
      title: item.trackName || title,
      author: item.artistName || null,
      description: cleanDescription,
      coverUrl,
    };
  } catch (err) {
    console.error('iTunes metadata fetch failed:', err);
    return null;
  }
}

async function fetchMetadataUnified(title) {
  // Try Google Books first
  const googleMeta = await fetchGoogleBooksMetadata(title);
  if (googleMeta) return googleMeta;

  // Fallback to iTunes Search API
  console.log(`Google Books metadata query failed/exhausted for "${title}". Falling back to iTunes...`);
  return await fetchiTunesMetadata(title);
}

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file was uploaded' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const format = formatFromExt(ext);
  const kind = kindFromFormat(format);
  const filePath = req.file.path;
  const id = path.basename(filePath, ext);

  let meta = {
    title: titleFromFilename(req.file.originalname),
    author: null, description: null, series: null, seriesIndex: null,
    pageCount: null, coverBuffer: null, coverExt: 'jpg',
  };

  try {
    if (format === 'epub') {
      const epubMeta = await parseEpub(filePath);
      meta = { ...meta, ...epubMeta, title: epubMeta.title || meta.title };
    } else if (format === 'cbz') {
      const cbzMeta = await parseCbz(filePath);
      meta = { ...meta, ...cbzMeta };
    } else if (format === 'cbr') {
      const cbrMeta = await parseCbr(filePath);
      meta = { ...meta, ...cbrMeta };
    } else if (format === 'pdf') {
      const pdfMeta = await parsePdf(filePath);
      meta = { ...meta, ...pdfMeta, title: pdfMeta.title || meta.title };
    }
  } catch (e) {
    console.error('Metadata extraction failed:', e.message);
  }

  if (!meta.coverBuffer || !meta.author || !meta.description) {
    const extMeta = await fetchMetadataUnified(meta.title);
    if (extMeta) {
      if (!meta.author) meta.author = extMeta.author;
      if (!meta.description) meta.description = extMeta.description;
      if (!meta.tags && extMeta.tags) meta.tags = extMeta.tags;
      if (!meta.coverBuffer && extMeta.coverUrl) {
        try {
          const imgRes = await fetch(extMeta.coverUrl);
          if (imgRes.ok) {
            meta.coverBuffer = Buffer.from(await imgRes.arrayBuffer());
            meta.coverExt = 'jpg';
          }
        } catch (err) {
          console.error('Failed to download cover buffer on upload:', err);
        }
      }
      if (meta.title === titleFromFilename(req.file.originalname) && extMeta.title) {
        meta.title = extMeta.title;
      }
    }
  }

  let coverPath = null;
  if (meta.coverBuffer) {
    const coverFilename = `${id}.${meta.coverExt}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, 'covers', coverFilename), meta.coverBuffer);
    coverPath = coverFilename;
  }

  // Check for duplicates
  const duplicate = db.prepare('SELECT id FROM items WHERE title = ? AND file_size = ?').get(meta.title, req.file.size);
  if (duplicate) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(409).json({ error: 'This title is already in your library' });
  }

  db.prepare(`
    INSERT INTO items (id, kind, format, title, author, series, series_index, description,
                        cover_path, file_path, file_size, page_count, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, kind, format, meta.title, meta.author, meta.series, meta.seriesIndex, meta.description,
    coverPath, path.basename(filePath), req.file.size, meta.pageCount, req.user.id
  );

  // Save tags on upload
  if (Array.isArray(meta.tags) && meta.tags.length > 0) {
    for (const tagName of meta.tags) {
      const trimmed = tagName.trim();
      if (!trimmed) continue;
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(trimmed);
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed);
      db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(id, tag.id);
    }
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json({ item });
});

router.get('/search-metadata', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
  const meta = await fetchMetadataUnified(q);
  if (!meta) return res.status(404).json({ error: 'No metadata found' });
  res.json({ meta });
});

router.get('/', authMiddleware, (req, res) => {
  const { kind, search, sort = 'added', tag, author, series, shelf, status } = req.query;
  let query = `
    SELECT items.*, progress.percent as my_percent, progress.status as my_status,
           (favorites.user_id IS NOT NULL) as is_favorite
    FROM items
    LEFT JOIN progress ON progress.item_id = items.id AND progress.user_id = ?
    LEFT JOIN favorites ON favorites.item_id = items.id AND favorites.user_id = ?
    WHERE 1=1
  `;
  const params = [req.user.id, req.user.id];

  if (kind) { query += ' AND items.kind = ?'; params.push(kind); }
  if (author) { query += ' AND items.author = ?'; params.push(author); }
  if (series) { query += ' AND items.series = ?'; params.push(series); }
  if (shelf) { 
    query += ' AND items.id IN (SELECT item_id FROM shelf_items WHERE shelf_id = ?)';
    params.push(shelf);
  }
  if (search) {
    query += ' AND (items.title LIKE ? OR items.author LIKE ? OR items.series LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (tag) {
    query += ` AND items.id IN (SELECT item_id FROM item_tags JOIN tags ON tags.id = item_tags.tag_id WHERE tags.name = ?)`;
    params.push(tag);
  }
  if (status) {
    if (status === 'reading') {
      query += " AND progress.status = 'reading'";
    } else if (status === 'finished') {
      query += " AND progress.status = 'finished'";
    } else if (status === 'not_started') {
      query += " AND (progress.status IS NULL OR (progress.status != 'reading' AND progress.status != 'finished'))";
    }
  }

  const sortMap = {
    added: 'items.created_at DESC',
    title: 'items.title ASC',
    author: 'items.author ASC',
    progress: 'progress.percent DESC',
  };
  query += ` ORDER BY ${sortMap[sort] || sortMap.added}`;

  const items = db.prepare(query).all(...params);

  for (const item of items) {
    const tags = db.prepare(`
      SELECT tags.name FROM tags JOIN item_tags ON item_tags.tag_id = tags.id WHERE item_tags.item_id = ?
    `).all(item.id).map((t) => t.name);
    item.tags = tags;
    item.is_favorite = !!item.is_favorite;
  }

  res.json({ items });
});

router.get('/facets', authMiddleware, (req, res) => {
  const { kind, shelf } = req.query;
  
  let itemFilter = 'WHERE 1=1';
  const params = [];
  if (kind) {
    itemFilter += ' AND items.kind = ?';
    params.push(kind);
  }
  if (shelf) {
    itemFilter += ' AND items.id IN (SELECT item_id FROM shelf_items WHERE shelf_id = ?)';
    params.push(shelf);
  }

  const authors = db.prepare(`
    SELECT author, COUNT(*) as count 
    FROM items 
    ${itemFilter.replace(/items\./g, '')} AND author IS NOT NULL 
    GROUP BY author 
    ORDER BY author
  `).all(...params);

  const series = db.prepare(`
    SELECT series, COUNT(*) as count 
    FROM items 
    ${itemFilter.replace(/items\./g, '')} AND series IS NOT NULL 
    GROUP BY series 
    ORDER BY series
  `).all(...params);

  const tags = db.prepare(`
    SELECT tags.name, COUNT(*) as count 
    FROM tags 
    JOIN item_tags ON item_tags.tag_id = tags.id 
    JOIN items ON items.id = item_tags.item_id 
    ${itemFilter}
    GROUP BY tags.id 
    ORDER BY name
  `).all(...params);

  res.json({ authors, series, tags });
});

router.get('/:id', authMiddleware, (req, res) => {
  const item = db.prepare(`
    SELECT items.*, progress.percent as my_percent, progress.status as my_status, progress.location as my_location,
           (favorites.user_id IS NOT NULL) as is_favorite
    FROM items
    LEFT JOIN progress ON progress.item_id = items.id AND progress.user_id = ?
    LEFT JOIN favorites ON favorites.item_id = items.id AND favorites.user_id = ?
    WHERE items.id = ?
  `).get(req.user.id, req.user.id, req.params.id);

  if (!item) return res.status(404).json({ error: 'This title was not found' });
  item.is_favorite = !!item.is_favorite;
  item.tags = db.prepare(`
    SELECT tags.name FROM tags JOIN item_tags ON item_tags.tag_id = tags.id WHERE item_tags.item_id = ?
  `).all(item.id).map((t) => t.name);

  res.json({ item });
});

router.patch('/:id', authMiddleware, async (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'This title was not found' });

  const fields = ['title', 'author', 'series', 'series_index', 'description'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }
  if (updates.length) {
    params.push(req.params.id);
    db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  if (req.body.coverUrl) {
    try {
      const imgRes = await fetch(req.body.coverUrl);
      if (imgRes.ok) {
        const coverFilename = `${req.params.id}.jpg`;
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(path.join(UPLOADS_DIR, 'covers', coverFilename), buffer);
        db.prepare('UPDATE items SET cover_path = ? WHERE id = ?').run(coverFilename, req.params.id);
      }
    } catch (err) {
      console.error('Failed to download cover from coverUrl on PATCH:', err);
    }
  }

  if (Array.isArray(req.body.tags)) {
    db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(req.params.id);
    for (const tagName of req.body.tags) {
      const trimmed = tagName.trim();
      if (!trimmed) continue;
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(trimmed);
      const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed);
      db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(req.params.id, tag.id);
    }
  }

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  res.json({ item: updated });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'This title was not found' });

  const filePath = path.join(UPLOADS_DIR, 'books', item.file_path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  if (item.cover_path) {
    const coverPath = path.join(UPLOADS_DIR, 'covers', item.cover_path);
    if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  }
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/cover', (req, res) => {
  const item = db.prepare('SELECT cover_path FROM items WHERE id = ?').get(req.params.id);
  if (!item || !item.cover_path) return res.status(404).end();
  res.sendFile(path.join(UPLOADS_DIR, 'covers', item.cover_path));
});

router.post('/:id/cover', authMiddleware, uploadCover.single('cover'), (req, res) => {
  const item = db.prepare('SELECT cover_path FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'This title was not found' });
  if (!req.file) return res.status(400).json({ error: 'No cover file uploaded' });

  // Delete old cover if exists
  if (item.cover_path) {
    const oldPath = path.join(UPLOADS_DIR, 'covers', item.cover_path);
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (err) {
        console.error('Failed to delete old cover file:', err);
      }
    }
  }

  db.prepare('UPDATE items SET cover_path = ? WHERE id = ?').run(req.file.filename, req.params.id);
  res.json({ ok: true, cover_path: req.file.filename });
});

router.get('/:id/file', authMiddleware, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'This title was not found' });
  const filePath = path.join(UPLOADS_DIR, 'books', item.file_path);
  res.sendFile(filePath);
});

// Comic page list + individual page image serving
router.get('/:id/pages', authMiddleware, async (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item || item.kind !== 'comic') return res.status(404).json({ error: 'Not a comic' });
  try {
    const filePath = path.join(UPLOADS_DIR, 'books', item.file_path);
    const pages = await getComicPageList(filePath, item.format);
    res.json({ pages });
  } catch (e) {
    res.status(500).json({ error: 'Could not read pages from this archive' });
  }
});

router.get('/:id/page/:index', authMiddleware, async (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item || item.kind !== 'comic') return res.status(404).json({ error: 'Not a comic' });
  try {
    const filePath = path.join(UPLOADS_DIR, 'books', item.file_path);
    const pages = await getComicPageList(filePath, item.format);
    const entryName = pages[parseInt(req.params.index, 10)];
    if (!entryName) return res.status(404).json({ error: 'Page out of range' });
    const buf = await extractComicPage(filePath, item.format, entryName);
    if (!buf) return res.status(404).end();
    const ext = path.extname(entryName).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'private, max-age=86400');
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: 'Could not extract that page' });
  }
});

router.get('/:id/comments', authMiddleware, (req, res) => {
  try {
    const comments = db.prepare(`
      SELECT item_comments.*, users.username, users.color as user_color, users.avatar_path as user_avatar
      FROM item_comments
      JOIN users ON users.id = item_comments.user_id
      WHERE item_comments.item_id = ?
      ORDER BY item_comments.created_at ASC
    `).all(req.params.id);
    res.json({ comments });
  } catch (e) {
    console.error('Retrieve comments failed:', e);
    res.status(500).json({ error: 'Failed to retrieve comments' });
  }
});

router.post('/:id/comments', authMiddleware, (req, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment body is required' });
  try {
    const commentId = nanoid(12);
    db.prepare(`
      INSERT INTO item_comments (id, item_id, user_id, comment, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(commentId, req.params.id, req.user.id, comment.trim());
    
    const newComment = db.prepare(`
      SELECT item_comments.*, users.username, users.color as user_color, users.avatar_path as user_avatar
      FROM item_comments
      JOIN users ON users.id = item_comments.user_id
      WHERE item_comments.id = ?
    `).get(commentId);
    res.json({ comment: newComment });
  } catch (e) {
    console.error('Add comment failed:', e);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
