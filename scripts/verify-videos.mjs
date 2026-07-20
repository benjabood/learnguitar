/**
 * Verify every YouTube video referenced by the curriculum still exists:
 *  1. every lesson's videoId must be in data/verified-videos.json
 *  2. every used videoId must return HTTP 200 from YouTube oEmbed
 *
 * Usage: node scripts/verify-videos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsDir = path.join(rootDir, 'data', 'lessons');
const poolPath = path.join(rootDir, 'data', 'verified-videos.json');

const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
const poolIds = new Set(pool.videos.map(v => v.id));

const usedIds = new Map(); // id -> [days]
for (const file of fs.readdirSync(lessonsDir).filter(f => /^week-\d{2}\.json$/.test(f))) {
  const parsed = JSON.parse(fs.readFileSync(path.join(lessonsDir, file), 'utf8'));
  for (const lesson of parsed.days || []) {
    const id = lesson.youtube?.videoId;
    if (!id) continue;
    if (!usedIds.has(id)) usedIds.set(id, []);
    usedIds.get(id).push(lesson.day);
  }
}

let failures = 0;
for (const [id, days] of usedIds) {
  if (!poolIds.has(id)) {
    console.error(`NOT IN POOL: ${id} (days ${days.join(', ')})`);
    failures++;
  }
}

console.log(`Checking ${usedIds.size} unique videos against YouTube oEmbed...`);
for (const [id, days] of usedIds) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log(`OK  ${id} (days ${days.join(', ')})`);
    } else {
      console.error(`FAIL ${res.status} ${id} (days ${days.join(', ')}) — replace this link`);
      failures++;
    }
  } catch (err) {
    console.error(`ERROR ${id}: ${err.message}`);
    failures++;
  }
}

if (failures) {
  console.error(`\n${failures} video problem(s) found.`);
  process.exit(1);
}
console.log('All curriculum videos verified.');
