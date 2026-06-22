import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import progressRoutes from './routes/progress.js';
import shelvesRoutes from './routes/shelves.js';
import highlightsRoutes from './routes/highlights.js';
import analyticsRoutes from './routes/analytics.js';
import notionRoutes from './routes/notion.js';
import annotationsRoutes from './routes/annotations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4100;

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/shelves', shelvesRoutes);
app.use('/api/highlights', highlightsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notion', notionRoutes);
app.use('/api/annotations', annotationsRoutes);

// Serve the built frontend
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
app.use(express.static(PUBLIC_DIR));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong on the server' });
});

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

app.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanIp();
  console.log(`\nLibra is running.`);
  console.log(`  Local:   http://localhost:${PORT}`);
  if (lanIp) console.log(`  Network: http://${lanIp}:${PORT}`);
  console.log('');
});
