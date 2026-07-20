/**
 * Date-anchored schedule math. Curriculum day N maps to startDate + N - 1.
 * All dates are 'YYYY-MM-DD' strings; arithmetic is done in UTC to avoid
 * DST edge cases.
 */

export const TOTAL_DAYS = 90;

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(dateStr) {
  const m = DATE_RE.exec(String(dateStr));
  if (!m) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDate(utcMs) {
  const d = new Date(utcMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateStr(value) {
  return DATE_RE.test(String(value || ''));
}

export function localDateStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateStr, offset) {
  return formatDate(parseDate(dateStr) + offset * DAY_MS);
}

export function dateForDay(startDate, day) {
  return addDays(startDate, day - 1);
}

export function dayForDate(startDate, dateStr) {
  return Math.round((parseDate(dateStr) - parseDate(startDate)) / DAY_MS) + 1;
}

/**
 * Compute date-anchored progress.
 * - behind: past curriculum days (date < today) not completed
 * - ahead:  future curriculum days (date > today) already completed
 * - currentDay: lowest incomplete day (the next lesson), null when done
 */
export function computeProgress(state, todayStr, totalDays = TOTAL_DAYS) {
  const { startDate, completions = {} } = state;
  const rawDay = dayForDate(startDate, todayStr);
  const expectedDay = Math.max(0, Math.min(rawDay, totalDays));

  let behind = 0;
  let ahead = 0;
  let completedCount = 0;
  let currentDay = null;

  for (let d = 1; d <= totalDays; d++) {
    const isDone = Boolean(completions[d]);
    if (isDone) {
      completedCount++;
    } else if (currentDay === null) {
      currentDay = d;
    }
    if (d < rawDay && !isDone) behind++;
    if (d > rawDay && isDone) ahead++;
  }

  const percent = Math.round((completedCount / totalDays) * 100);
  return { expectedDay, currentDay, completedCount, behind, ahead, percent };
}

/**
 * Practice streak: consecutive calendar days with at least one completed
 * lesson, ending today (or yesterday if today has no practice yet).
 */
export function computeStreak(completions, todayStr) {
  const practiceDates = new Set(Object.values(completions || {}));
  if (practiceDates.size === 0) {
    return 0;
  }

  let cursor = practiceDates.has(todayStr) ? todayStr : addDays(todayStr, -1);
  let streak = 0;
  while (practiceDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
