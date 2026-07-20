import { api } from '../api.js';
import { renderDiagram } from '../diagrams.js';
import { createRecorder, isRecordingSupported } from '../recorder.js';
import { showToast, showAchievementToasts } from '../toast.js';

let activeTimerId = null;
let recTickId = null;
let activeRecorder = null;

function clearTimers() {
  if (activeTimerId) clearInterval(activeTimerId);
  if (recTickId) clearInterval(recTickId);
  activeTimerId = null;
  recTickId = null;
}

/**
 * Tear down the currently mounted lesson view: stops timers and releases
 * the microphone if a recording was left running. The router calls this
 * before every navigation.
 */
export function disposeLessonView() {
  clearTimers();
  if (activeRecorder) {
    try {
      activeRecorder.cancel();
    } catch {
      /* already stopped */
    }
    activeRecorder = null;
  }
}

function fmt(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtClock(ms) {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

export function renderLesson(container, lesson, ctx) {
  clearTimers();
  container.innerHTML = '';

  // ---- header ----
  const back = document.createElement('a');
  back.href = '#/';
  back.className = 'back-link';
  back.textContent = '← Back to calendar';
  container.appendChild(back);

  const header = document.createElement('div');
  header.className = 'lesson-header';
  const dayPill = document.createElement('span');
  dayPill.className = 'pill';
  dayPill.textContent = `Day ${lesson.day} · Week ${lesson.week} · ${lesson.date}`;
  header.appendChild(dayPill);
  if (lesson.isReview) {
    const r = document.createElement('span');
    r.className = 'pill review';
    r.textContent = '🔁 Review day';
    header.appendChild(r);
  }
  const donePill = document.createElement('span');
  donePill.className = 'pill done';
  donePill.style.display = lesson.completedOn ? '' : 'none';
  donePill.textContent = `✓ Completed ${lesson.completedOn || ''}`;
  header.appendChild(donePill);
  container.appendChild(header);

  const h2 = document.createElement('h2');
  h2.textContent = lesson.title;
  h2.style.margin = '0.3rem 0';
  container.appendChild(h2);

  const intro = document.createElement('p');
  intro.className = 'lesson-intro';
  intro.textContent = lesson.intro;
  container.appendChild(intro);

  // ---- steps + timer ----
  const stepsCard = document.createElement('div');
  stepsCard.className = 'card';
  const totalMin = lesson.steps.reduce((sum, s) => sum + s.minutes, 0);
  const stepsTitle = document.createElement('h3');
  stepsTitle.textContent = `Today's practice (~${totalMin} min) — ${lesson.focus}`;
  stepsCard.appendChild(stepsTitle);

  for (const step of lesson.steps) {
    const el = document.createElement('div');
    el.className = 'step';
    const min = document.createElement('span');
    min.className = 'min';
    min.textContent = `${step.minutes} min`;
    const body = document.createElement('div');
    const h4 = document.createElement('h4');
    h4.textContent = step.title;
    const p = document.createElement('p');
    p.textContent = step.instructions;
    body.append(h4, p);
    el.append(min, body);
    stepsCard.appendChild(el);
  }

  const timerRow = document.createElement('div');
  timerRow.className = 'timer-row';
  const timerBtn = document.createElement('button');
  timerBtn.textContent = '▶ Start practice timer';
  const timerDisplay = document.createElement('span');
  timerDisplay.className = 'timer-display';
  let remaining = totalMin * 60;
  let running = false;
  timerDisplay.textContent = fmt(remaining);

  function tick() {
    remaining = Math.max(0, remaining - 1);
    timerDisplay.textContent = fmt(remaining);
    if (remaining === 0) {
      clearInterval(activeTimerId);
      activeTimerId = null;
      running = false;
      timerDisplay.classList.add('done');
      timerDisplay.textContent = 'Time! Great work 🎉';
      timerBtn.textContent = '↺ Reset timer';
      remaining = totalMin * 60;
    }
  }

  timerBtn.addEventListener('click', () => {
    if (timerDisplay.classList.contains('done')) {
      timerDisplay.classList.remove('done');
      timerDisplay.textContent = fmt(remaining);
      timerBtn.textContent = '▶ Start practice timer';
      return;
    }
    running = !running;
    if (running) {
      activeTimerId = setInterval(tick, 1000);
    } else if (activeTimerId) {
      clearInterval(activeTimerId);
      activeTimerId = null;
    }
    timerBtn.textContent = running ? '⏸ Pause' : '▶ Resume';
  });
  timerRow.append(timerBtn, timerDisplay);
  stepsCard.appendChild(timerRow);
  container.appendChild(stepsCard);

  // ---- diagrams ----
  if (lesson.diagrams?.length) {
    const diagCard = document.createElement('div');
    diagCard.className = 'card';
    const t = document.createElement('h3');
    t.textContent = 'Charts for today';
    diagCard.appendChild(t);
    const wrap = document.createElement('div');
    wrap.className = 'diagrams';
    for (const d of lesson.diagrams) {
      const box = document.createElement('div');
      box.className = 'diagram';
      box.innerHTML = renderDiagram(d);
      wrap.appendChild(box);
    }
    diagCard.appendChild(wrap);
    container.appendChild(diagCard);
  }

  // ---- video ----
  const videoCard = document.createElement('div');
  videoCard.className = 'card';
  const vt = document.createElement('h3');
  vt.textContent = 'Watch & play along';
  videoCard.appendChild(vt);
  const vwrap = document.createElement('div');
  vwrap.className = 'video-wrap';
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${lesson.youtube.videoId}`;
  iframe.title = lesson.youtube.title;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  vwrap.appendChild(iframe);
  videoCard.appendChild(vwrap);
  const vlink = document.createElement('a');
  vlink.className = 'video-link';
  vlink.href = `https://www.youtube.com/watch?v=${lesson.youtube.videoId}`;
  vlink.target = '_blank';
  vlink.rel = 'noopener';
  vlink.textContent = `▶ ${lesson.youtube.title} — ${lesson.youtube.channel} (open on YouTube)`;
  videoCard.appendChild(vlink);
  container.appendChild(videoCard);

  // ---- tips ----
  if (lesson.tips?.length) {
    const tipsCard = document.createElement('div');
    tipsCard.className = 'card';
    const tt = document.createElement('h3');
    tt.textContent = 'Tips';
    tipsCard.appendChild(tt);
    const ul = document.createElement('ul');
    ul.style.margin = '0';
    ul.style.paddingLeft = '1.2rem';
    for (const tip of lesson.tips) {
      const li = document.createElement('li');
      li.textContent = tip;
      li.style.color = 'var(--text-dim)';
      ul.appendChild(li);
    }
    tipsCard.appendChild(ul);
    container.appendChild(tipsCard);
  }

  // ---- recordings ----
  const recCard = document.createElement('div');
  recCard.className = 'card';
  const rt = document.createElement('h3');
  rt.textContent = '🎙️ Practice recordings for this day';
  recCard.appendChild(rt);
  const recHint = document.createElement('p');
  recHint.style.cssText = 'margin:0 0 0.5rem;font-size:0.85rem;color:var(--text-dim)';
  recHint.textContent = "Record ~60 seconds of today's practice. Listening back week over week is how you'll hear yourself improving.";
  recCard.appendChild(recHint);

  const recBtn = document.createElement('button');
  const recStatus = document.createElement('span');
  recStatus.className = 'rec-meta';
  const recRow = document.createElement('div');
  recRow.className = 'timer-row';
  recRow.append(recBtn, recStatus);
  recCard.appendChild(recRow);

  const list = document.createElement('ul');
  list.className = 'rec-list';
  recCard.appendChild(list);
  container.appendChild(recCard);

  function renderRecList(recordings) {
    list.innerHTML = '';
    if (!recordings.length) {
      const li = document.createElement('li');
      li.className = 'rec-meta';
      li.textContent = 'No recordings yet for this day.';
      list.appendChild(li);
      return;
    }
    for (const r of recordings) {
      const li = document.createElement('li');
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.src = `/api/recordings/${r.filename}`;
      const meta = document.createElement('span');
      meta.className = 'rec-meta';
      meta.textContent = `${fmtClock(r.createdAt)} · ${(r.size / 1024).toFixed(0)} KB`;
      const del = document.createElement('button');
      del.className = 'danger-ghost';
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        if (!confirm('Delete this recording?')) return;
        try {
          await api.deleteRecording(r.filename);
          renderRecList((await api.lesson(lesson.day)).recordings);
        } catch (err) {
          showToast('⚠️ Could not delete', err.message);
        }
      });
      li.append(audio, meta, del);
      list.appendChild(li);
    }
  }
  renderRecList(lesson.recordings || []);

  const recorder = createRecorder();
  activeRecorder = recorder;
  if (!isRecordingSupported()) {
    recBtn.disabled = true;
    recStatus.textContent = 'Recording not supported in this browser.';
  } else {
    recBtn.textContent = '● Record';
    recBtn.addEventListener('click', async () => {
      if (!recorder.isRecording) {
        try {
          await recorder.start();
        } catch (err) {
          showToast('⚠️ Microphone problem', err.message);
          return;
        }
        recBtn.textContent = '■ Stop & save';
        recBtn.classList.add('recording');
        let secs = 0;
        recStatus.textContent = 'Recording… 0:00';
        recTickId = setInterval(() => {
          secs++;
          recStatus.textContent = `Recording… ${fmt(secs)}`;
        }, 1000);
      } else {
        clearInterval(recTickId);
        recTickId = null;
        recBtn.disabled = true;
        recStatus.textContent = 'Saving…';
        try {
          const blob = await recorder.stop();
          const result = await api.uploadRecording(lesson.day, blob);
          showAchievementToasts(result.newAchievements);
          renderRecList(result.recordings);
          recStatus.textContent = 'Saved ✓';
          ctx.refreshHeader();
        } catch (err) {
          showToast('⚠️ Could not save recording', err.message);
          recStatus.textContent = '';
        }
        recBtn.disabled = false;
        recBtn.textContent = '● Record';
        recBtn.classList.remove('recording');
      }
    });
  }

  // ---- complete ----
  const bar = document.createElement('div');
  bar.className = 'complete-bar';
  const completeBtn = document.createElement('button');
  completeBtn.className = 'primary';
  const undoBtn = document.createElement('button');
  undoBtn.className = 'danger-ghost';
  undoBtn.textContent = 'Undo completion';

  function setDoneUi(completedOn) {
    if (completedOn) {
      completeBtn.textContent = `✓ Day ${lesson.day} complete!`;
      completeBtn.disabled = true;
      undoBtn.style.display = '';
      donePill.style.display = '';
      donePill.textContent = `✓ Completed ${completedOn}`;
    } else {
      completeBtn.textContent = `Mark Day ${lesson.day} complete ✓`;
      completeBtn.disabled = false;
      undoBtn.style.display = 'none';
      donePill.style.display = 'none';
    }
  }
  setDoneUi(lesson.completedOn);

  completeBtn.addEventListener('click', async () => {
    completeBtn.disabled = true;
    try {
      const result = await api.complete(lesson.day);
      showAchievementToasts(result.newAchievements);
      setDoneUi(result.overview.completions[lesson.day]);
      ctx.setOverview(result.overview);
    } catch (err) {
      completeBtn.disabled = false;
      showToast('⚠️ Could not mark complete', err.message);
    }
  });

  undoBtn.addEventListener('click', async () => {
    try {
      const result = await api.uncomplete(lesson.day);
      setDoneUi(null);
      ctx.setOverview(result.overview);
    } catch (err) {
      showToast('⚠️ Could not undo', err.message);
    }
  });

  bar.append(completeBtn, undoBtn);
  container.appendChild(bar);
}
