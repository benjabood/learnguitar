/**
 * Validate one or more week-NN.json lesson files against the content schema
 * and the verified video pool.
 *
 * Usage: node scripts/validate-week.mjs data/lessons/week-01.json [more...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLesson } from '../src/lib/lessons.js';
import { TOTAL_DAYS } from '../src/lib/schedule.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const poolPath = path.join(rootDir, 'data', 'verified-videos.json');

const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));
const videoIds = new Set(pool.videos.map(v => v.id));
const videoById = new Map(pool.videos.map(v => [v.id, v]));

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/validate-week.mjs <week-file.json> [...]');
  process.exit(2);
}

let allErrors = [];

for (const file of files) {
  const errors = [];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    allErrors.push(`${file}: invalid JSON — ${err.message}`);
    continue;
  }

  const week = parsed.week;
  if (!Number.isInteger(week) || week < 1 || week > 13) {
    errors.push('week must be an integer 1-13');
  }
  if (!Array.isArray(parsed.days)) {
    errors.push('expected shape { week, days: [...] }');
  } else {
    const expectedFirst = (week - 1) * 7 + 1;
    const expectedLast = Math.min(week * 7, TOTAL_DAYS);
    const gotDays = parsed.days.map(d => d.day).sort((a, b) => a - b);
    const wantDays = [];
    for (let d = expectedFirst; d <= expectedLast; d++) wantDays.push(d);
    if (JSON.stringify(gotDays) !== JSON.stringify(wantDays)) {
      errors.push(`days must be exactly [${wantDays.join(', ')}], got [${gotDays.join(', ')}]`);
    }
    for (const lesson of parsed.days) {
      errors.push(...validateLesson(lesson, { videoIds }));
      const yt = lesson.youtube;
      if (yt && videoById.has(yt.videoId)) {
        const v = videoById.get(yt.videoId);
        if (yt.title !== v.title) errors.push(`day ${lesson.day}: youtube.title must exactly match pool title: ${JSON.stringify(v.title)}`);
        if (yt.channel !== v.channel) errors.push(`day ${lesson.day}: youtube.channel must exactly match pool channel: ${JSON.stringify(v.channel)}`);
      }
    }
  }

  if (errors.length) {
    allErrors.push(...errors.map(e => `${file}: ${e}`));
  } else {
    console.log(`OK ${file} (${parsed.days.length} lessons)`);
  }
}

if (allErrors.length) {
  console.error(`\n${allErrors.length} error(s):`);
  for (const e of allErrors) console.error(' - ' + e);
  process.exit(1);
}
console.log('All files valid.');
