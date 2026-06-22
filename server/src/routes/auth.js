import express from 'express';
import { db } from '../db/index.js';
import { hashPassword, verifyPassword, issueToken, authMiddleware } from '../auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { UPLOADS_DIR } from '../db/index.js';

if (!fs.existsSync(path.join(UPLOADS_DIR, 'avatars'))) {
  fs.mkdirSync(path.join(UPLOADS_DIR, 'avatars'), { recursive: true });
}

const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS_DIR, 'avatars')),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.user.id}-${nanoid(8)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) cb(null, true);
    else cb(new Error('Unsupported image type. Use JPG, PNG, or WEBP.'));
  },
});

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username needs at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password needs at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'That username is taken' });

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const isFirstUser = userCount === 0;
  const colors = ['#c98a3e', '#7c9885', '#7e91c9', '#c97e9e', '#9e8ac9'];
  const color = colors[userCount % colors.length];

  const result = db.prepare(
    'INSERT INTO users (username, password_hash, is_admin, color) VALUES (?, ?, ?, ?)'
  ).run(username, hashPassword(password), isFirstUser ? 1 : 0, color);

  const user = { id: result.lastInsertRowid, username, is_admin: isFirstUser ? 1 : 0 };
  const token = issueToken(user);
  res.cookie('libra_token', token, COOKIE_OPTS);
  res.json({ user: { id: user.id, username, is_admin: !!user.is_admin, color, avatar_path: null, theme_preference: null } });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  const token = issueToken(user);
  res.cookie('libra_token', token, COOKIE_OPTS);
  res.json({ user: { id: user.id, username: user.username, is_admin: !!user.is_admin, color: user.color, avatar_path: user.avatar_path, theme_preference: user.theme_preference } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('libra_token');
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, is_admin, color, avatar_path, theme_preference, notion_token, notion_database_id, daily_page_goal, daily_minute_goal FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });
  res.json({ user: { ...user, is_admin: !!user.is_admin } });
});

router.patch('/profile', authMiddleware, (req, res) => {
  const { theme_preference, color, notion_token, notion_database_id, daily_page_goal, daily_minute_goal } = req.body;
  const updates = [];
  const params = [];

  if (theme_preference !== undefined) {
    updates.push('theme_preference = ?');
    params.push(theme_preference);
  }
  if (color !== undefined) {
    updates.push('color = ?');
    params.push(color);
  }
  if (notion_token !== undefined) {
    updates.push('notion_token = ?');
    params.push(notion_token);
  }
  if (notion_database_id !== undefined) {
    updates.push('notion_database_id = ?');
    params.push(notion_database_id);
  }
  if (daily_page_goal !== undefined) {
    updates.push('daily_page_goal = ?');
    params.push(parseInt(daily_page_goal, 10));
  }
  if (daily_minute_goal !== undefined) {
    updates.push('daily_minute_goal = ?');
    params.push(parseInt(daily_minute_goal, 10));
  }

  if (updates.length > 0) {
    params.push(req.user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare('SELECT id, username, is_admin, color, avatar_path, theme_preference, notion_token, notion_database_id, daily_page_goal, daily_minute_goal FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: { ...updated, is_admin: !!updated.is_admin } });
});

router.post('/avatar', authMiddleware, uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No avatar file uploaded' });

  const user = db.prepare('SELECT avatar_path FROM users WHERE id = ?').get(req.user.id);
  if (user && user.avatar_path) {
    const oldPath = path.join(UPLOADS_DIR, 'avatars', user.avatar_path);
    if (fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch (e) { console.error('Failed to delete old avatar:', e); }
    }
  }

  db.prepare('UPDATE users SET avatar_path = ? WHERE id = ?').run(req.file.filename, req.user.id);
  const updated = db.prepare('SELECT id, username, is_admin, color, avatar_path, theme_preference FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: { ...updated, is_admin: !!updated.is_admin } });
});

router.get('/avatar/:filename', (req, res) => {
  res.sendFile(path.join(UPLOADS_DIR, 'avatars', req.params.filename));
});

router.get('/users-exist', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  res.json({ exists: count > 0 });
});

export default router;
