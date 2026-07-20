/**
 * Windows-98-styled password gate, ported 1:1 from the fishgame (finspan)
 * project's PasswordGate.tsx. This is a casual access screen for a personal
 * site, not real security — the check is client-side.
 */
const KEY = 'fishgameAuth';
const PASSWORD = 'kibbeh';

export function initPasswordGate() {
  if (localStorage.getItem(KEY) === '1') return;

  const overlay = document.createElement('div');
  overlay.className = 'win98-gate';

  const form = document.createElement('form');
  form.className = 'win98-window';

  const title = document.createElement('div');
  title.className = 'win98-title';
  title.textContent = '90-Day Guitar';

  const body = document.createElement('div');
  body.className = 'win98-body';

  const label = document.createElement('p');
  label.className = 'win98-label';
  label.textContent = 'password please . . .';

  const input = document.createElement('input');
  input.type = 'password';
  input.className = 'win98-input';
  input.setAttribute('aria-label', 'Password');

  const error = document.createElement('p');
  error.className = 'win98-error';
  error.textContent = 'Incorrect password.';
  error.style.display = 'none';

  const buttons = document.createElement('div');
  buttons.className = 'win98-buttons';

  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'win98-btn';
  btn.textContent = 'OK';

  input.addEventListener('input', () => {
    error.style.display = 'none';
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (input.value.trim().toLowerCase() === PASSWORD) {
      localStorage.setItem(KEY, '1');
      overlay.remove();
    } else {
      error.style.display = '';
    }
  });

  buttons.appendChild(btn);
  body.append(label, input, error, buttons);
  form.append(title, body);
  overlay.appendChild(form);
  document.body.appendChild(overlay);
  input.focus();
}
