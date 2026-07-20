import express from 'express';
import path from 'node:path';
import { createStore } from './lib/store.js';
import { loadLessons } from './lib/lessons.js';
import { createApiRouter } from './routes/api.js';

/**
 * App factory — everything injectable so tests can run against temp dirs
 * and a frozen clock.
 */
export function createApp({ dataDir, lessonsDir, publicDir, videoIds = null, now } = {}) {
  const store = createStore(dataDir);
  const lessons = loadLessons(lessonsDir, { videoIds });
  const recordingsDir = path.join(dataDir, 'recordings');

  const app = express();
  app.disable('x-powered-by');

  app.use('/api', createApiRouter({ store, lessons, recordingsDir, now }));
  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, data: null, error: 'Unknown API route' });
  });

  if (publicDir) {
    app.use(express.static(publicDir));
  }

  // eslint-disable-next-line no-unused-vars -- express identifies error handlers by arity
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ success: false, data: null, error: 'Recording too large (25 MB max)' });
    }
    console.error('[app] unhandled error:', err);
    res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  });

  return app;
}
