import { describe, test, expect } from 'vitest';
import { ACHIEVEMENTS, evaluateAchievements } from '../src/lib/achievements.js';

function ctx(overrides = {}) {
  return {
    completedCount: 0,
    streak: 0,
    ahead: 0,
    behind: 0,
    wasBehind3: false,
    recordingsCount: 0,
    completions: {},
    ...overrides
  };
}

describe('ACHIEVEMENTS definitions', () => {
  test('every achievement has id, name, description, icon, and check()', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(12);
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.icon).toBeTruthy();
      expect(typeof a.check).toBe('function');
    }
  });

  test('ids are unique', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('evaluateAchievements', () => {
  test('first lesson unlocks first-lesson only', () => {
    const earned = evaluateAchievements(ctx({ completedCount: 1 }), []);
    expect(earned).toContain('first-lesson');
    expect(earned).not.toContain('streak-3');
  });

  test('already-unlocked achievements are not re-earned', () => {
    const earned = evaluateAchievements(ctx({ completedCount: 1 }), ['first-lesson']);
    expect(earned).not.toContain('first-lesson');
  });

  test('streak achievements unlock at thresholds', () => {
    const earned = evaluateAchievements(ctx({ completedCount: 7, streak: 7 }), []);
    expect(earned).toContain('streak-3');
    expect(earned).toContain('streak-7');
    expect(earned).not.toContain('streak-14');
  });

  test('ahead achievements unlock from days ahead', () => {
    const earned = evaluateAchievements(ctx({ completedCount: 5, ahead: 3 }), []);
    expect(earned).toContain('ahead-1');
    expect(earned).toContain('ahead-3');
    expect(earned).not.toContain('ahead-7');
  });

  test('comeback unlocks after being 3+ behind and catching up', () => {
    const notYet = evaluateAchievements(ctx({ completedCount: 5, wasBehind3: true, behind: 1 }), []);
    expect(notYet).not.toContain('comeback');
    const earned = evaluateAchievements(ctx({ completedCount: 5, wasBehind3: true, behind: 0 }), []);
    expect(earned).toContain('comeback');
  });

  test('recording achievements', () => {
    const earned = evaluateAchievements(ctx({ recordingsCount: 10 }), []);
    expect(earned).toContain('first-recording');
    expect(earned).toContain('recordings-10');
    expect(earned).not.toContain('recordings-25');
  });

  test('review-master requires all 12 review days (7,14,...,84)', () => {
    const completions = {};
    for (let d = 7; d <= 84; d += 7) completions[d] = '2026-07-01';
    const earned = evaluateAchievements(ctx({ completedCount: 12, completions }), []);
    expect(earned).toContain('review-master');

    const partial = { ...completions };
    delete partial[84];
    const notEarned = evaluateAchievements(ctx({ completedCount: 11, completions: partial }), []);
    expect(notEarned).not.toContain('review-master');
  });

  test('graduate unlocks at 90 lessons', () => {
    const earned = evaluateAchievements(ctx({ completedCount: 90 }), []);
    expect(earned).toContain('graduate');
    expect(earned).toContain('halfway');
  });

  test('evaluate does not mutate its inputs', () => {
    const c = ctx({ completedCount: 1 });
    const unlocked = [];
    evaluateAchievements(c, unlocked);
    expect(unlocked).toEqual([]);
    expect(c.completedCount).toBe(1);
  });
});
