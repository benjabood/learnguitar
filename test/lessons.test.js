import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLessons } from '../src/lib/lessons.js';
import { TOTAL_DAYS } from '../src/lib/schedule.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsDir = path.join(rootDir, 'data', 'lessons');
const poolPath = path.join(rootDir, 'data', 'verified-videos.json');

describe('real curriculum content', () => {
  const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
  const videoIds = new Set(pool.videos.map(v => v.id));

  test('all 90 days load, validate, and only use verified videos', () => {
    const lessons = loadLessons(lessonsDir, { videoIds });
    expect(lessons).toHaveLength(TOTAL_DAYS);
    expect(lessons.map(l => l.day)).toEqual(Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1));
  });

  test('every 7th day (and only those) is a review day', () => {
    const lessons = loadLessons(lessonsDir, { videoIds });
    const reviewDays = lessons.filter(l => l.isReview).map(l => l.day);
    const expected = [];
    for (let d = 7; d <= 84; d += 7) expected.push(d);
    expect(reviewDays).toEqual(expected);
  });

  test('lessons are ~15 minutes and always include a diagram and one video', () => {
    const lessons = loadLessons(lessonsDir, { videoIds });
    for (const l of lessons) {
      const minutes = l.steps.reduce((sum, s) => sum + s.minutes, 0);
      expect(minutes, `day ${l.day} minutes`).toBeGreaterThanOrEqual(12);
      expect(minutes, `day ${l.day} minutes`).toBeLessThanOrEqual(18);
      expect(l.diagrams.length, `day ${l.day} diagrams`).toBeGreaterThanOrEqual(1);
      expect(videoIds.has(l.youtube.videoId), `day ${l.day} video in pool`).toBe(true);
    }
  });

  test('the curriculum starts at the very beginning and ends with graduation', () => {
    const lessons = loadLessons(lessonsDir, { videoIds });
    expect(lessons[0].week).toBe(1);
    expect(lessons[TOTAL_DAYS - 1].week).toBe(13);
  });
});
