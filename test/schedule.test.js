import { describe, test, expect } from 'vitest';
import {
  dateForDay,
  dayForDate,
  addDays,
  computeProgress,
  computeStreak,
  TOTAL_DAYS
} from '../src/lib/schedule.js';

const START = '2026-07-01';

describe('dateForDay / dayForDate', () => {
  test('day 1 maps to the start date', () => {
    expect(dateForDay(START, 1)).toBe('2026-07-01');
    expect(dayForDate(START, '2026-07-01')).toBe(1);
  });

  test('day 31 crosses a month boundary', () => {
    expect(dateForDay(START, 31)).toBe('2026-07-31');
    expect(dateForDay(START, 32)).toBe('2026-08-01');
    expect(dayForDate(START, '2026-08-01')).toBe(32);
  });

  test('day 90 maps 89 days after start', () => {
    expect(dateForDay(START, 90)).toBe('2026-09-28');
  });

  test('addDays handles negative offsets', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
  });
});

describe('computeProgress (date-anchored)', () => {
  test('on day 1 with nothing completed: expected day 1, nothing behind or ahead', () => {
    const p = computeProgress({ startDate: START, completions: {} }, START);
    expect(p.expectedDay).toBe(1);
    expect(p.behind).toBe(0);
    expect(p.ahead).toBe(0);
    expect(p.completedCount).toBe(0);
    expect(p.currentDay).toBe(1);
  });

  test('missed days accumulate as behind (date-anchored)', () => {
    // Today is day 5; days 1-2 done, days 3-4 missed
    const completions = { 1: '2026-07-01', 2: '2026-07-02' };
    const p = computeProgress({ startDate: START, completions }, '2026-07-05');
    expect(p.expectedDay).toBe(5);
    expect(p.behind).toBe(2); // days 3 and 4 are past and incomplete
    expect(p.ahead).toBe(0);
    expect(p.currentDay).toBe(3); // next incomplete lesson
  });

  test('completing future days counts as ahead', () => {
    // Today is day 2; days 1-5 all completed
    const completions = { 1: '2026-07-01', 2: '2026-07-02', 3: '2026-07-02', 4: '2026-07-02', 5: '2026-07-02' };
    const p = computeProgress({ startDate: START, completions }, '2026-07-02');
    expect(p.ahead).toBe(3); // days 3, 4, 5 are future and complete
    expect(p.behind).toBe(0);
    expect(p.currentDay).toBe(6);
  });

  test("completing today's lesson is neither ahead nor behind", () => {
    const completions = { 1: '2026-07-01' };
    const p = computeProgress({ startDate: START, completions }, START);
    expect(p.ahead).toBe(0);
    expect(p.behind).toBe(0);
  });

  test('expectedDay caps at TOTAL_DAYS after the schedule ends', () => {
    const p = computeProgress({ startDate: START, completions: {} }, '2027-01-01');
    expect(p.expectedDay).toBe(TOTAL_DAYS);
    expect(p.behind).toBe(TOTAL_DAYS); // every past day incomplete
  });

  test('all 90 complete: currentDay is null, percent 100', () => {
    const completions = {};
    for (let d = 1; d <= TOTAL_DAYS; d++) completions[d] = '2026-07-01';
    const p = computeProgress({ startDate: START, completions }, '2026-08-01');
    expect(p.currentDay).toBeNull();
    expect(p.percent).toBe(100);
  });

  test('before the start date expectedDay is 0 and nothing is behind', () => {
    const p = computeProgress({ startDate: '2026-08-01', completions: {} }, '2026-07-20');
    expect(p.expectedDay).toBe(0);
    expect(p.behind).toBe(0);
  });
});

describe('computeStreak', () => {
  test('empty completions → streak 0', () => {
    expect(computeStreak({}, '2026-07-05')).toBe(0);
  });

  test('counts consecutive days ending today', () => {
    const completions = { 1: '2026-07-03', 2: '2026-07-04', 3: '2026-07-05' };
    expect(computeStreak(completions, '2026-07-05')).toBe(3);
  });

  test('still counts if today has no practice yet (streak ends yesterday)', () => {
    const completions = { 1: '2026-07-03', 2: '2026-07-04' };
    expect(computeStreak(completions, '2026-07-05')).toBe(2);
  });

  test('broken streak resets', () => {
    const completions = { 1: '2026-07-01', 2: '2026-07-04' };
    expect(computeStreak(completions, '2026-07-05')).toBe(1);
  });

  test('multiple lessons on the same date count as one streak day', () => {
    const completions = { 1: '2026-07-04', 2: '2026-07-04', 3: '2026-07-05' };
    expect(computeStreak(completions, '2026-07-05')).toBe(2);
  });

  test('gap of more than one day before today → streak 0', () => {
    const completions = { 1: '2026-07-01', 2: '2026-07-02' };
    expect(computeStreak(completions, '2026-07-05')).toBe(0);
  });
});
