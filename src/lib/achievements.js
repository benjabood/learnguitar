import { TOTAL_DAYS } from './schedule.js';

const REVIEW_DAYS = Object.freeze(
  Array.from({ length: Math.floor((TOTAL_DAYS - 1) / 7) }, (_, i) => (i + 1) * 7)
);

const streakAchievement = (days, name, icon) => ({
  id: `streak-${days}`,
  name,
  icon,
  description: `Practice ${days} days in a row`,
  check: c => c.streak >= days
});

const aheadAchievement = (days, name, icon) => ({
  id: `ahead-${days}`,
  name,
  icon,
  description: `Get ${days} day${days > 1 ? 's' : ''} ahead of schedule`,
  check: c => c.ahead >= days
});

export const ACHIEVEMENTS = Object.freeze([
  {
    id: 'first-lesson',
    name: 'First Strum',
    icon: '🎸',
    description: 'Complete your first lesson',
    check: c => c.completedCount >= 1
  },
  {
    id: 'seven-lessons',
    name: 'Week One Done',
    icon: '📅',
    description: 'Complete 7 lessons',
    check: c => c.completedCount >= 7
  },
  streakAchievement(3, 'Warming Up', '🔥'),
  streakAchievement(7, 'On Fire', '🔥'),
  streakAchievement(14, 'Two-Week Machine', '⚡'),
  streakAchievement(30, 'Habit Formed', '🏆'),
  streakAchievement(60, 'Unstoppable', '🚀'),
  streakAchievement(90, 'Iron Fingers', '🛡️'),
  aheadAchievement(1, 'Overachiever', '⏩'),
  aheadAchievement(3, 'Ahead of the Curve', '📈'),
  aheadAchievement(7, 'A Week in the Future', '🔮'),
  {
    id: 'comeback',
    name: 'The Comeback',
    icon: '💪',
    description: 'Fall 3+ days behind, then fully catch up',
    check: c => Boolean(c.wasBehind3) && c.behind === 0 && c.completedCount > 0
  },
  {
    id: 'first-recording',
    name: 'On the Record',
    icon: '🎙️',
    description: 'Save your first practice recording',
    check: c => c.recordingsCount >= 1
  },
  {
    id: 'recordings-10',
    name: 'Studio Regular',
    icon: '🎧',
    description: 'Save 10 practice recordings',
    check: c => c.recordingsCount >= 10
  },
  {
    id: 'recordings-25',
    name: 'Album Material',
    icon: '💿',
    description: 'Save 25 practice recordings',
    check: c => c.recordingsCount >= 25
  },
  {
    id: 'halfway',
    name: 'Halfway There',
    icon: '⛰️',
    description: 'Complete 45 lessons',
    check: c => c.completedCount >= Math.ceil(TOTAL_DAYS / 2)
  },
  {
    id: 'review-master',
    name: 'Review Master',
    icon: '🧠',
    description: 'Complete every weekly review day',
    check: c => REVIEW_DAYS.every(d => Boolean((c.completions || {})[d]))
  },
  {
    id: 'graduate',
    name: 'Graduate',
    icon: '🎓',
    description: 'Complete all 90 days',
    check: c => c.completedCount >= TOTAL_DAYS
  }
]);

/**
 * Returns the ids of achievements newly earned given the current context,
 * excluding anything already unlocked. Pure — mutates nothing.
 */
export function evaluateAchievements(ctx, unlockedIds) {
  const unlocked = new Set(unlockedIds || []);
  return ACHIEVEMENTS.filter(a => !unlocked.has(a.id) && a.check(ctx)).map(a => a.id);
}
