import { initPasswordGate } from './gate.js';
import { api } from './api.js';
import { renderCalendar } from './views/calendar.js';
import { renderLesson, disposeLessonView } from './views/lesson.js';
import { renderAchievements } from './views/achievements.js';

const main = document.getElementById('app');
const statsEl = document.getElementById('header-stats');

let overview = null;

function renderHeader() {
  if (!overview) return;
  const { progress, streak, totalDays } = overview;
  statsEl.innerHTML = '';

  const dayChip = document.createElement('span');
  dayChip.className = 'stat-chip accent';
  dayChip.textContent =
    progress.currentDay === null
      ? '🎓 All 90 days complete!'
      : `Day ${Math.min(Math.max(progress.expectedDay, 1), totalDays)} of ${totalDays} · next lesson: Day ${progress.currentDay}`;

  const paceChip = document.createElement('span');
  if (progress.behind > 0) {
    paceChip.className = 'stat-chip bad';
    paceChip.textContent = `⏰ ${progress.behind} day${progress.behind > 1 ? 's' : ''} behind`;
  } else if (progress.ahead > 0) {
    paceChip.className = 'stat-chip good';
    paceChip.textContent = `⏩ ${progress.ahead} day${progress.ahead > 1 ? 's' : ''} ahead`;
  } else {
    paceChip.className = 'stat-chip good';
    paceChip.textContent = '✔ On track';
  }

  const streakChip = document.createElement('span');
  streakChip.className = 'stat-chip' + (streak > 0 ? ' accent' : '');
  streakChip.textContent = `🔥 ${streak} day streak`;

  const doneChip = document.createElement('span');
  doneChip.className = 'stat-chip';
  doneChip.textContent = `${progress.completedCount}/${totalDays} lessons (${progress.percent}%)`;

  statsEl.append(dayChip, paceChip, streakChip, doneChip);

  const track = document.createElement('div');
  track.className = 'progress-track';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  fill.style.width = `${progress.percent}%`;
  track.appendChild(fill);
  statsEl.appendChild(track);
}

function setOverview(newOverview) {
  overview = newOverview;
  renderHeader();
}

async function refreshHeader() {
  try {
    overview = await api.overview();
    renderHeader();
  } catch {
    /* header refresh is best-effort */
  }
}

function setActiveNav(hash) {
  document.querySelectorAll('[data-nav]').forEach(a => {
    const isAch = a.dataset.nav === 'achievements';
    a.classList.toggle('active', isAch === hash.startsWith('#/achievements'));
  });
}

async function route() {
  disposeLessonView(); // release mic + timers from any previous lesson view
  const hash = location.hash || '#/';
  setActiveNav(hash);
  main.innerHTML = '<p class="loading">Loading…</p>';
  try {
    if (hash.startsWith('#/day/')) {
      if (!overview) overview = await api.overview();
      renderHeader();
      const day = Number(hash.split('/')[2]);
      const lesson = await api.lesson(day);
      renderLesson(main, lesson, { setOverview, refreshHeader });
      window.scrollTo(0, 0);
    } else if (hash.startsWith('#/achievements')) {
      overview = await api.overview();
      renderHeader();
      renderAchievements(main, overview);
    } else {
      overview = await api.overview();
      renderHeader();
      renderCalendar(main, overview);
    }
  } catch (err) {
    main.innerHTML = '';
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = err.message;
    main.appendChild(banner);
  }
}

initPasswordGate();
window.addEventListener('hashchange', route);
route();
