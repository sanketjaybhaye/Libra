import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(UPLOADS_DIR, 'books'))) fs.mkdirSync(path.join(UPLOADS_DIR, 'books'), { recursive: true });
if (!fs.existsSync(path.join(UPLOADS_DIR, 'covers'))) fs.mkdirSync(path.join(UPLOADS_DIR, 'covers'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'libra.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#c98a3e',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('book','comic')),
  format TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  series TEXT,
  series_index REAL,
  description TEXT,
  cover_path TEXT,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  page_count INTEGER,
  added_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  location TEXT,
  percent REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','reading','finished')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS shelves (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shelf_items (
  shelf_id TEXT NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (shelf_id, item_id)
);

CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  location_cfi TEXT NOT NULL,
  text TEXT NOT NULL,
  note TEXT,
  color TEXT NOT NULL DEFAULT '#c98a3e',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_kind ON items(kind);
CREATE INDEX IF NOT EXISTS idx_items_author ON items(author);
CREATE INDEX IF NOT EXISTS idx_items_series ON items(series);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_shelves_user ON shelves(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_item ON highlights(user_id, item_id);
`);

// Lightweight Schema Migrations
try { db.exec("ALTER TABLE users ADD COLUMN avatar_path TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN theme_preference TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE progress ADD COLUMN finished_at TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE shelves ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN notion_token TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN notion_database_id TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN daily_page_goal INTEGER DEFAULT 20;"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN daily_minute_goal INTEGER DEFAULT 30;"); } catch (e) {}
try { db.exec("ALTER TABLE reading_history ADD COLUMN minutes_read INTEGER DEFAULT 0;"); } catch (e) {}

// New tables
db.exec(`
CREATE TABLE IF NOT EXISTS reading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  pages_read INTEGER NOT NULL,
  minutes_read INTEGER NOT NULL DEFAULT 0,
  read_date TEXT NOT NULL DEFAULT (date('now')),
  UNIQUE(user_id, item_id, read_date)
);

CREATE TABLE IF NOT EXISTS item_comments (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_annotations (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  strokes_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(item_id, user_id, page_index)
);

CREATE INDEX IF NOT EXISTS idx_reading_history_user_date ON reading_history(user_id, read_date);
CREATE INDEX IF NOT EXISTS idx_item_comments_item ON item_comments(item_id);
`);

export { db, DATA_DIR, UPLOADS_DIR };
