export function renderAchievements(container, overview) {
  container.innerHTML = '';
  const unlockedCount = overview.achievements.filter(a => a.unlockedAt).length;

  const h = document.createElement('h2');
  h.textContent = `Achievements (${unlockedCount}/${overview.achievements.length})`;
  container.appendChild(h);

  const grid = document.createElement('div');
  grid.className = 'ach-grid';

  for (const a of overview.achievements) {
    const card = document.createElement('div');
    card.className = 'ach-card' + (a.unlockedAt ? '' : ' locked');

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = a.icon;
    const name = document.createElement('h3');
    name.textContent = a.name;
    const desc = document.createElement('p');
    desc.textContent = a.description;
    card.append(icon, name, desc);

    if (a.unlockedAt) {
      const when = document.createElement('span');
      when.className = 'when';
      when.textContent = `Unlocked ${a.unlockedAt}`;
      card.appendChild(when);
    }
    grid.appendChild(card);
  }

  container.appendChild(grid);
}
