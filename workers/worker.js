/**
 * Cloudflare Worker adapter for the guitar practice site.
 *
 * Mirrors the Express API in src/routes/api.js with the same response
 * envelope, reusing the pure domain logic (schedule, achievements) and the
 * bundled lesson content. Differences from the Node server:
 *   - state lives in Workers KV under the 'state' key
 *   - recordings are KV binary values under 'rec:<filename>' keys
 *   - "today" is computed in the visitor's timezone (request.cf.timezone)
 */
import { computeProgress, computeStreak, dateForDay, isValidDateStr, TOTAL_DAYS } from '../src/lib/schedule.js';
import { ACHIEVEMENTS, evaluateAchievements } from '../src/lib/achievements.js';
import week01 from '../data/lessons/week-01.json';
import week02 from '../data/lessons/week-02.json';
import week03 from '../data/lessons/week-03.json';
import week04 from '../data/lessons/week-04.json';
import week05 from '../data/lessons/week-05.json';
import week06 from '../data/lessons/week-06.json';
import week07 from '../data/lessons/week-07.json';
import week08 from '../data/lessons/week-08.json';
import week09 from '../data/lessons/week-09.json';
import week10 from '../data/lessons/week-10.json';
import week11 from '../data/lessons/week-11.json';
import week12 from '../data/lessons/week-12.json';
import week13 from '../data/lessons/week-13.json';

const LESSONS = [week01, week02, week03, week04, week05, week06, week07, week08, week09, week10, week11, week12, week13]
  .flatMap(w => w.days)
  .sort((a, b) => a.day - b.day);
const lessonsByDay = new Map(LESSONS.map(l => [l.day, l]));

const STATE_KEY = 'state';
const REC_PREFIX = 'rec:';
const MAX_RECORDING_BYTES = 25 * 1024 * 1024;
const FILENAME_RE = /^day-(\d{2})-(\d+)(?:-[a-f0-9]{8})?\.(webm|ogg|m4a|mp3|wav)$/;
const EXT_BY_MIME = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav'
};
const MIME_BY_EXT = { webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav' };

const ok = (data, status = 200) => Response.json({ success: true, data, error: null }, { status });
const fail = (error, status = 400) => Response.json({ success: false, data: null, error }, { status });

function extForMime(mime) {
  const base = String(mime || '').split(';')[0].trim().toLowerCase();
  return EXT_BY_MIME[base] || null;
}

function mimeForFilename(name) {
  const m = FILENAME_RE.exec(String(name || ''));
  return m ? MIME_BY_EXT[m[3]] : null;
}

/** Today as YYYY-MM-DD in the visitor's timezone (falls back to UTC). */
function todayFor(request) {
  const timeZone = request.cf?.timezone || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function normalizeState(parsed, today) {
  return {
    startDate: isValidDateStr(parsed.startDate) ? parsed.startDate : today,
    completions: { ...(parsed.completions || {}) },
    achievements: { ...(parsed.achievements || {}) },
    wasBehind3: Boolean(parsed.wasBehind3)
  };
}

async function loadState(env, today) {
  let parsed = null;
  try {
    parsed = await env.STATE.get(STATE_KEY, 'json');
  } catch {
    /* malformed json in KV — start fresh below */
  }
  if (parsed && typeof parsed === 'object') {
    return normalizeState(parsed, today);
  }
  const fresh = normalizeState({}, today);
  await env.STATE.put(STATE_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveState(env, state) {
  return env.STATE.put(STATE_KEY, JSON.stringify(state));
}

async function listRecordings(env, day = null) {
  const { keys } = await env.STATE.list({ prefix: REC_PREFIX, limit: 1000 });
  return keys
    .map(k => ({ filename: k.name.slice(REC_PREFIX.length), ...(k.metadata || {}) }))
    .filter(r => FILENAME_RE.test(r.filename))
    .filter(r => day === null || Number(r.day) === Number(day))
    .sort((a, b) => a.createdAt - b.createdAt);
}

function achievementList(state) {
  return ACHIEVEMENTS.map(a => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    description: a.description,
    unlockedAt: state.achievements[a.id] || null
  }));
}

async function buildOverview(env, today) {
  const state = await loadState(env, today);
  const progress = computeProgress(state, today);
  const streak = computeStreak(state.completions, today);
  const recordingDays = {};
  for (const r of await listRecordings(env)) {
    recordingDays[r.day] = (recordingDays[r.day] || 0) + 1;
  }
  return {
    startDate: state.startDate,
    today,
    totalDays: TOTAL_DAYS,
    progress,
    streak,
    completions: state.completions,
    achievements: achievementList(state),
    recordingDays,
    lessons: LESSONS.map(l => ({
      day: l.day,
      week: l.week,
      title: l.title,
      isReview: l.isReview,
      focus: l.focus,
      date: dateForDay(state.startDate, l.day)
    }))
  };
}

async function evaluateAndStore(env, today) {
  const state = await loadState(env, today);
  const progress = computeProgress(state, today);
  const wasBehind3 = state.wasBehind3 || progress.behind >= 3;
  const ctx = {
    completedCount: progress.completedCount,
    streak: computeStreak(state.completions, today),
    ahead: progress.ahead,
    behind: progress.behind,
    wasBehind3,
    recordingsCount: (await listRecordings(env)).length,
    completions: state.completions
  };
  const newIds = evaluateAchievements(ctx, Object.keys(state.achievements));
  const achievements = { ...state.achievements };
  for (const id of newIds) {
    achievements[id] = today;
  }
  await saveState(env, { ...state, wasBehind3, achievements });
  return newIds;
}

function newAchievementDetails(ids) {
  return ACHIEVEMENTS.filter(a => ids.includes(a.id)).map(a => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    description: a.description
  }));
}

function parseDay(value) {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= TOTAL_DAYS ? day : null;
}

function randomHex8() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    const today = todayFor(request);
    const method = request.method;

    try {
      if (pathname === '/api/overview' && method === 'GET') {
        return ok(await buildOverview(env, today));
      }

      const lessonMatch = /^\/api\/lessons\/([^/]+)$/.exec(pathname);
      if (lessonMatch && method === 'GET') {
        const day = parseDay(lessonMatch[1]);
        if (day === null) return fail(`day must be an integer 1-${TOTAL_DAYS}`);
        const lesson = lessonsByDay.get(day);
        if (!lesson) return fail(`No lesson found for day ${day}`, 404);
        const state = await loadState(env, today);
        return ok({
          ...lesson,
          date: dateForDay(state.startDate, day),
          completedOn: state.completions[day] || null,
          recordings: await listRecordings(env, day)
        });
      }

      const completeMatch = /^\/api\/lessons\/([^/]+)\/complete$/.exec(pathname);
      if (completeMatch) {
        const day = parseDay(completeMatch[1]);
        if (day === null) return fail(`day must be an integer 1-${TOTAL_DAYS}`);
        if (method === 'POST') {
          const state = await loadState(env, today);
          const already = Boolean(state.completions[day]);
          if (!already) {
            await saveState(env, { ...state, completions: { ...state.completions, [day]: today } });
          }
          const newIds = already ? [] : await evaluateAndStore(env, today);
          return ok({
            day,
            alreadyCompleted: already,
            newAchievements: newAchievementDetails(newIds),
            overview: await buildOverview(env, today)
          });
        }
        if (method === 'DELETE') {
          const state = await loadState(env, today);
          const completions = { ...state.completions };
          delete completions[day];
          await saveState(env, { ...state, completions });
          return ok({ day, overview: await buildOverview(env, today) });
        }
      }

      const recListMatch = /^\/api\/lessons\/([^/]+)\/recordings$/.exec(pathname);
      if (recListMatch) {
        const day = parseDay(recListMatch[1]);
        if (day === null) return fail(`day must be an integer 1-${TOTAL_DAYS}`);
        if (method === 'GET') {
          return ok(await listRecordings(env, day));
        }
        if (method === 'POST') {
          const mime = request.headers.get('content-type');
          const ext = extForMime(mime);
          if (!ext) return fail('Request body must be non-empty audio/* data');
          const body = await request.arrayBuffer();
          if (body.byteLength === 0) return fail('Request body must be non-empty audio/* data');
          if (body.byteLength > MAX_RECORDING_BYTES) return fail('Recording too large (25 MB max)', 413);
          const filename = `day-${String(day).padStart(2, '0')}-${Date.now()}-${randomHex8()}.${ext}`;
          await env.STATE.put(`${REC_PREFIX}${filename}`, body, {
            metadata: { day, createdAt: Date.now(), size: body.byteLength }
          });
          const newIds = await evaluateAndStore(env, today);
          return ok(
            {
              filename,
              day,
              newAchievements: newAchievementDetails(newIds),
              recordings: await listRecordings(env, day)
            },
            201
          );
        }
      }

      const recFileMatch = /^\/api\/recordings\/([^/]+)$/.exec(pathname);
      if (recFileMatch) {
        const filename = decodeURIComponent(recFileMatch[1]);
        if (!FILENAME_RE.test(filename)) return fail('Invalid recording filename');
        if (method === 'GET') {
          const body = await env.STATE.get(`${REC_PREFIX}${filename}`, 'arrayBuffer');
          if (!body) return fail('Recording not found', 404);
          return new Response(body, { headers: { 'Content-Type': mimeForFilename(filename) } });
        }
        if (method === 'DELETE') {
          const existing = await env.STATE.get(`${REC_PREFIX}${filename}`, 'arrayBuffer');
          if (!existing) return fail('Recording not found', 404);
          await env.STATE.delete(`${REC_PREFIX}${filename}`);
          return ok({ deleted: filename });
        }
      }

      return fail('Unknown API route', 404);
    } catch (err) {
      console.error('worker error:', err);
      return fail('Internal server error', 500);
    }
  }
};
