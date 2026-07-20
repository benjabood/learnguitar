const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return { y, m, d };
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function dateStr(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function renderCalendar(container, overview) {
  const { lessons, completions, recordingDays, today } = overview;
  const byDate = new Map(lessons.map(l => [l.date, l]));

  const first = parseDate(lessons[0].date);
  const last = parseDate(lessons[lessons.length - 1].date);

  container.innerHTML = '';

  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = `
    <span><span class="swatch" style="background:var(--green-soft);border:1px solid var(--green)"></span>Done</span>
    <span><span class="swatch" style="background:var(--red-soft);border:1px solid var(--red)"></span>Missed (catch up!)</span>
    <span><span class="swatch" style="background:var(--bg-card);border:1px solid var(--accent)"></span>Today</span>
    <span>🔁 review day</span>
    <span>🎙️ has recording</span>`;
  container.appendChild(legend);

  let y = first.y;
  let m = first.m;
  let todayCell = null;

  while (y < last.y || (y === last.y && m <= last.m)) {
    const section = document.createElement('section');
    section.className = 'month';
    const h2 = document.createElement('h2');
    h2.textContent = `${MONTH_NAMES[m - 1]} ${y}`;
    section.appendChild(h2);

    const grid = document.createElement('div');
    grid.className = 'month-grid';
    for (const wd of WEEKDAYS) {
      const el = document.createElement('div');
      el.className = 'weekday';
      el.textContent = wd;
      grid.appendChild(el);
    }

    const firstDow = new Date(y, m - 1, 1).getDay();
    for (let i = 0; i < firstDow; i++) {
      grid.appendChild(document.createElement('div'));
    }

    const total = daysInMonth(y, m);
    for (let d = 1; d <= total; d++) {
      const ds = dateStr(y, m, d);
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      const dom = document.createElement('span');
      dom.className = 'dom';
      dom.textContent = String(d);
      cell.appendChild(dom);

      const lesson = byDate.get(ds);
      if (lesson) {
        cell.classList.add('lesson-day');
        const done = Boolean(completions[lesson.day]);
        if (done) cell.classList.add('done');
        else if (ds < today) cell.classList.add('missed');
        if (ds === today) {
          cell.classList.add('today-cell');
          todayCell = cell;
        }

        const dayNum = document.createElement('span');
        dayNum.className = 'daynum';
        const dayLabel = document.createElement('span');
        dayLabel.className = 'd-label'; // hidden on narrow screens so the number never wraps
        dayLabel.textContent = 'Day ';
        dayNum.append(dayLabel, document.createTextNode(String(lesson.day)));
        cell.appendChild(dayNum);

        const title = document.createElement('span');
        title.className = 'cell-title';
        title.textContent = lesson.title;
        cell.appendChild(title);

        const badges = document.createElement('span');
        badges.className = 'badges';
        badges.textContent = `${lesson.isReview ? '🔁' : ''}${recordingDays[lesson.day] ? '🎙️' : ''}`;
        cell.appendChild(badges);

        cell.addEventListener('click', () => {
          location.hash = `#/day/${lesson.day}`;
        });
      }
      grid.appendChild(cell);
    }

    section.appendChild(grid);
    container.appendChild(section);

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  if (todayCell) {
    todayCell.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}
