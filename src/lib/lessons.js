import fs from 'node:fs';
import path from 'node:path';
import { TOTAL_DAYS } from './schedule.js';

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const STRUM_VALUES = new Set(['D', 'U', '']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateDiagram(diagram, where, errors) {
  if (!diagram || typeof diagram !== 'object') {
    errors.push(`${where}: diagram must be an object`);
    return;
  }
  if (diagram.type === 'chord') {
    if (!isNonEmptyString(diagram.name)) errors.push(`${where}: chord diagram needs a name`);
    if (!Array.isArray(diagram.frets) || diagram.frets.length !== 6 || !diagram.frets.every(f => Number.isInteger(f) && f >= -1 && f <= 15)) {
      errors.push(`${where}: chord frets must be 6 integers (-1 = muted, 0 = open)`);
    }
    if (diagram.fingers !== undefined && (!Array.isArray(diagram.fingers) || diagram.fingers.length !== 6 || !diagram.fingers.every(f => Number.isInteger(f) && f >= 0 && f <= 4))) {
      errors.push(`${where}: chord fingers must be 6 integers 0-4 when present`);
    }
  } else if (diagram.type === 'strum') {
    if (!isNonEmptyString(diagram.name)) errors.push(`${where}: strum diagram needs a name`);
    if (!Array.isArray(diagram.beats) || diagram.beats.length !== 8 || !diagram.beats.every(b => STRUM_VALUES.has(b))) {
      errors.push(`${where}: strum beats must be 8 slots of 'D', 'U', or ''`);
    }
  } else if (diagram.type === 'tab') {
    if (!isNonEmptyString(diagram.name)) errors.push(`${where}: tab diagram needs a name`);
    if (!Array.isArray(diagram.notes) || diagram.notes.length === 0 || !diagram.notes.every(n => n && Number.isInteger(n.string) && n.string >= 1 && n.string <= 6 && Number.isInteger(n.fret) && n.fret >= 0 && n.fret <= 15)) {
      errors.push(`${where}: tab notes must each have string 1-6 and fret 0-15`);
    }
  } else {
    errors.push(`${where}: unknown diagram type '${diagram.type}'`);
  }
}

export function validateLesson(lesson, { videoIds = null } = {}) {
  const errors = [];
  if (!lesson || typeof lesson !== 'object') {
    return ['lesson must be an object'];
  }
  const where = `day ${lesson.day}`;

  if (!Number.isInteger(lesson.day) || lesson.day < 1 || lesson.day > TOTAL_DAYS) {
    errors.push(`${where}: day must be an integer 1-${TOTAL_DAYS}`);
    return errors;
  }
  if (lesson.week !== Math.ceil(lesson.day / 7)) {
    errors.push(`${where}: week must be ${Math.ceil(lesson.day / 7)}`);
  }
  if (lesson.isReview !== (lesson.day % 7 === 0)) {
    errors.push(`${where}: isReview must be ${lesson.day % 7 === 0} (every 7th day is review)`);
  }
  if (!isNonEmptyString(lesson.title)) errors.push(`${where}: missing title`);
  if (!isNonEmptyString(lesson.focus)) errors.push(`${where}: missing focus`);
  if (!isNonEmptyString(lesson.intro)) errors.push(`${where}: missing intro`);

  if (!Array.isArray(lesson.steps) || lesson.steps.length < 2 || lesson.steps.length > 8) {
    errors.push(`${where}: steps must be an array of 2-8 entries`);
  } else {
    let totalMinutes = 0;
    lesson.steps.forEach((step, i) => {
      if (!step || !Number.isInteger(step.minutes) || step.minutes < 1 || step.minutes > 15) {
        errors.push(`${where} step ${i + 1}: minutes must be an integer 1-15`);
      } else {
        totalMinutes += step.minutes;
      }
      if (!step || !isNonEmptyString(step.title)) errors.push(`${where} step ${i + 1}: missing title`);
      if (!step || !isNonEmptyString(step.instructions)) errors.push(`${where} step ${i + 1}: missing instructions`);
    });
    if (totalMinutes < 12 || totalMinutes > 18) {
      errors.push(`${where}: step minutes total ${totalMinutes}, expected 12-18 (~15 minute lesson)`);
    }
  }

  if (!Array.isArray(lesson.diagrams) || lesson.diagrams.length === 0) {
    errors.push(`${where}: needs at least one diagram`);
  } else {
    lesson.diagrams.forEach((d, i) => validateDiagram(d, `${where} diagram ${i + 1}`, errors));
  }

  const yt = lesson.youtube;
  if (!yt || typeof yt !== 'object' || !YT_ID_RE.test(String(yt.videoId || ''))) {
    errors.push(`${where}: youtube.videoId must be an 11-char YouTube id`);
  } else {
    if (!isNonEmptyString(yt.title)) errors.push(`${where}: youtube.title missing`);
    if (!isNonEmptyString(yt.channel)) errors.push(`${where}: youtube.channel missing`);
    if (videoIds && !videoIds.has(yt.videoId)) {
      errors.push(`${where}: youtube.videoId '${yt.videoId}' is not in the verified video pool`);
    }
  }

  if (lesson.tips !== undefined && (!Array.isArray(lesson.tips) || lesson.tips.length > 4 || !lesson.tips.every(isNonEmptyString))) {
    errors.push(`${where}: tips must be an array of up to 4 non-empty strings`);
  }

  return errors;
}

/**
 * Loads all week-*.json files, validates every lesson, and verifies the 90
 * days are each present exactly once. Throws with a full error report on
 * any problem — the server should refuse to start with broken content.
 */
export function loadLessons(lessonsDir, { videoIds = null } = {}) {
  if (!fs.existsSync(lessonsDir)) {
    throw new Error(`Lessons directory not found: ${lessonsDir}`);
  }
  const files = fs
    .readdirSync(lessonsDir)
    .filter(f => /^week-\d{2}\.json$/.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error(`No week-*.json lesson files found in ${lessonsDir}`);
  }

  const errors = [];
  const byDay = new Map();

  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(lessonsDir, file), 'utf8'));
    } catch (err) {
      errors.push(`${file}: invalid JSON (${err.message})`);
      continue;
    }
    if (!Array.isArray(parsed.days)) {
      errors.push(`${file}: expected { week, days: [...] }`);
      continue;
    }
    for (const lesson of parsed.days) {
      errors.push(...validateLesson(lesson, { videoIds }));
      if (Number.isInteger(lesson.day)) {
        if (byDay.has(lesson.day)) {
          errors.push(`day ${lesson.day}: defined more than once`);
        } else {
          byDay.set(lesson.day, lesson);
        }
      }
    }
  }

  for (let d = 1; d <= TOTAL_DAYS; d++) {
    if (!byDay.has(d)) errors.push(`day ${d}: missing from curriculum`);
  }

  if (errors.length > 0) {
    throw new Error(`Lesson content validation failed:\n${errors.join('\n')}`);
  }

  return [...byDay.values()].sort((a, b) => a.day - b.day);
}
