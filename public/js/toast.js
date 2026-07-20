const TOAST_MS = 4500;

export function showToast(title, description = '') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  const t = document.createElement('div');
  t.className = 't-title';
  t.textContent = title;
  const d = document.createElement('div');
  d.className = 't-desc';
  d.textContent = description;
  el.append(t, d);
  host.appendChild(el);
  setTimeout(() => el.remove(), TOAST_MS);
}

export function showAchievementToasts(achievements) {
  (achievements || []).forEach((a, i) => {
    setTimeout(() => showToast(`${a.icon} Achievement: ${a.name}`, a.description), i * 600);
  });
}
