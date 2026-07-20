import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { localDateStr, isValidDateStr } from './schedule.js';

/**
 * JSON-file-backed state store for a single user. Writes are atomic
 * (temp file + rename). All reads/updates go through defensive copies —
 * callers can never mutate internal state.
 *
 * State shape:
 * {
 *   startDate: 'YYYY-MM-DD',
 *   completions: { [day: number]: 'YYYY-MM-DD' },
 *   achievements: { [id: string]: 'YYYY-MM-DD' },
 *   wasBehind3: boolean
 * }
 */
export function createStore(dataDir) {
  const stateFile = path.join(dataDir, 'state.json');
  let state = loadInitial();

  function normalize(parsed) {
    if (parsed.startDate !== undefined && !isValidDateStr(parsed.startDate)) {
      console.warn(`[store] invalid startDate ${JSON.stringify(parsed.startDate)}; resetting to today`);
    }
    return {
      startDate: isValidDateStr(parsed.startDate) ? parsed.startDate : localDateStr(),
      completions: { ...(parsed.completions || {}) },
      achievements: { ...(parsed.achievements || {}) },
      wasBehind3: Boolean(parsed.wasBehind3)
    };
  }

  function loadInitial() {
    try {
      if (fs.existsSync(stateFile)) {
        const raw = fs.readFileSync(stateFile, 'utf8');
        try {
          return normalize(JSON.parse(raw));
        } catch {
          const backup = `${stateFile}.corrupt-${Date.now()}`;
          fs.copyFileSync(stateFile, backup);
          console.error(`[store] state.json was corrupt; backed up to ${backup} and starting fresh`);
        }
      }
    } catch (err) {
      console.error(`[store] failed reading ${stateFile}: ${err.message}`);
    }
    const fresh = normalize({});
    persist(fresh);
    return fresh;
  }

  function persist(next) {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmpFile = `${stateFile}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    fs.writeFileSync(tmpFile, JSON.stringify(next, null, 2), 'utf8');
    try {
      fs.renameSync(tmpFile, stateFile);
    } catch (err) {
      // Windows can refuse to rename over an existing file
      if (err.code === 'EEXIST' || err.code === 'EPERM') {
        fs.unlinkSync(stateFile);
        fs.renameSync(tmpFile, stateFile);
      } else {
        try {
          fs.unlinkSync(tmpFile);
        } catch {
          /* best effort cleanup */
        }
        throw err;
      }
    }
  }

  return {
    getState() {
      return structuredClone(state);
    },
    update(fn) {
      const next = fn(structuredClone(state));
      if (!next || typeof next !== 'object' || Array.isArray(next)) {
        throw new Error('store.update() callback must return a state object');
      }
      state = normalize(next);
      persist(state);
      return structuredClone(state);
    }
  };
}
