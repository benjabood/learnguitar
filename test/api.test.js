import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { TOTAL_DAYS } from '../src/lib/schedule.js';

const START = '2026-07-01';

function makeLesson(day) {
  return {
    day,
    week: Math.ceil(day / 7),
    title: `Lesson ${day}`,
    isReview: day % 7 === 0,
    focus: 'test focus',
    intro: 'Test intro sentence.',
    steps: [
      { minutes: 5, title: 'Warm-up', instructions: 'Do the warm-up.' },
      { minutes: 10, title: 'Main', instructions: 'Do the main practice.' }
    ],
    diagrams: [{ type: 'chord', name: 'A', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] }],
    youtube: { videoId: 'abcdefghijk', title: 'Test video', channel: 'Test channel' },
    tips: ['A tip']
  };
}

function writeFixtureLessons(lessonsDir) {
  fs.mkdirSync(lessonsDir, { recursive: true });
  for (let w = 1; w <= 13; w++) {
    const firstDay = (w - 1) * 7 + 1;
    const lastDay = Math.min(w * 7, TOTAL_DAYS);
    const days = [];
    for (let d = firstDay; d <= lastDay; d++) days.push(makeLesson(d));
    fs.writeFileSync(
      path.join(lessonsDir, `week-${String(w).padStart(2, '0')}.json`),
      JSON.stringify({ week: w, days }),
      'utf8'
    );
  }
}

let tmpDir;
let app;

function buildApp(todayStr) {
  return createApp({
    dataDir: path.join(tmpDir, 'data'),
    lessonsDir: path.join(tmpDir, 'lessons'),
    publicDir: null,
    now: () => todayStr
  });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guitar-api-'));
  writeFixtureLessons(path.join(tmpDir, 'lessons'));
  fs.mkdirSync(path.join(tmpDir, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'data', 'state.json'),
    JSON.stringify({ startDate: START, completions: {}, achievements: {}, wasBehind3: false }),
    'utf8'
  );
  app = buildApp(START);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/overview', () => {
  test('returns progress, achievements, and the 90-lesson list', async () => {
    const res = await request(app).get('/api/overview');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { data } = res.body;
    expect(data.startDate).toBe(START);
    expect(data.progress.expectedDay).toBe(1);
    expect(data.lessons).toHaveLength(TOTAL_DAYS);
    expect(data.achievements.length).toBeGreaterThanOrEqual(12);
    expect(data.achievements.every(a => a.unlockedAt === null)).toBe(true);
    expect(data.streak).toBe(0);
  });
});

describe('GET /api/lessons/:day', () => {
  test('returns the full lesson with completion and recordings', async () => {
    const res = await request(app).get('/api/lessons/5');
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Lesson 5');
    expect(res.body.data.completedOn).toBeNull();
    expect(res.body.data.recordings).toEqual([]);
    expect(res.body.data.date).toBe('2026-07-05');
  });

  test('rejects out-of-range and non-numeric days', async () => {
    expect((await request(app).get('/api/lessons/0')).status).toBe(400);
    expect((await request(app).get('/api/lessons/91')).status).toBe(400);
    expect((await request(app).get('/api/lessons/abc')).status).toBe(400);
  });
});

describe('POST /api/lessons/:day/complete', () => {
  test('marks complete and unlocks first-lesson', async () => {
    const res = await request(app).post('/api/lessons/1/complete');
    expect(res.status).toBe(200);
    expect(res.body.data.alreadyCompleted).toBe(false);
    expect(res.body.data.newAchievements.map(a => a.id)).toContain('first-lesson');
    expect(res.body.data.overview.completions['1']).toBe(START);
    expect(res.body.data.overview.streak).toBe(1);
  });

  test('is idempotent: repeat completion earns nothing new', async () => {
    await request(app).post('/api/lessons/1/complete');
    const res = await request(app).post('/api/lessons/1/complete');
    expect(res.status).toBe(200);
    expect(res.body.data.alreadyCompleted).toBe(true);
    expect(res.body.data.newAchievements).toEqual([]);
  });

  test('completing future days shows ahead (multi-lesson catch-up/advance)', async () => {
    await request(app).post('/api/lessons/1/complete');
    const res2 = await request(app).post('/api/lessons/2/complete');
    // completing tomorrow's lesson on day 1 makes you 1 day ahead
    expect(res2.body.data.newAchievements.map(a => a.id)).toContain('ahead-1');
    const res3 = await request(app).post('/api/lessons/3/complete');
    expect(res3.body.data.overview.progress.ahead).toBe(2);
  });

  test('DELETE removes a completion', async () => {
    await request(app).post('/api/lessons/1/complete');
    const res = await request(app).delete('/api/lessons/1/complete');
    expect(res.status).toBe(200);
    expect(res.body.data.overview.completions['1']).toBeUndefined();
  });
});

describe('recordings', () => {
  const audio = Buffer.from('fake-webm-audio-bytes');

  test('upload, list, stream, delete round-trip', async () => {
    const up = await request(app)
      .post('/api/lessons/3/recordings')
      .set('Content-Type', 'audio/webm')
      .send(audio);
    expect(up.status).toBe(201);
    const { filename, newAchievements } = up.body.data;
    expect(filename).toMatch(/^day-03-\d+-[a-f0-9]{8}\.webm$/);
    expect(newAchievements.map(a => a.id)).toContain('first-recording');

    const list = await request(app).get('/api/lessons/3/recordings');
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].filename).toBe(filename);

    const stream = await request(app).get(`/api/recordings/${filename}`);
    expect(stream.status).toBe(200);
    expect(stream.headers['content-type']).toContain('audio/webm');

    const del = await request(app).delete(`/api/recordings/${filename}`);
    expect(del.status).toBe(200);
    expect((await request(app).get('/api/lessons/3/recordings')).body.data).toEqual([]);
  });

  test('rejects empty or non-audio bodies', async () => {
    const res = await request(app)
      .post('/api/lessons/3/recordings')
      .set('Content-Type', 'text/plain')
      .send('hello');
    expect(res.status).toBe(400);
  });

  test('rejects traversal-style recording filenames', async () => {
    const res = await request(app).get('/api/recordings/..%2Fstate.json');
    expect([400, 404]).toContain(res.status);
    const res2 = await request(app).get('/api/recordings/notafile.webm');
    expect(res2.status).toBe(400);
  });

  test('404 for a validly-named recording that does not exist', async () => {
    const res = await request(app).get('/api/recordings/day-99-1234567890123.webm');
    expect(res.status).toBe(404);
  });
});

describe('unknown api routes', () => {
  test('return json 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
