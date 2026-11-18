import { esc, icons } from '../dom.js';
import { setUi } from '../store.js';
import { api } from '../api.js';
import { signedIn } from '../app.js';

const MIN_PASSWORD = 10;

// Shown instead of the app whenever the server answers 401. A real <form> with autocomplete
// hints, so the phone's password manager offers to save and fill it.
export function render(state, t) {
  const activating = state.ui.authMode === 'activate';
  const { authError: error, authBusy: busy } = state.ui;
  const field = (id, key, attrs) => `
    <div class="field">
      <label for="${id}">${esc(t(key, { min: MIN_PASSWORD }))}</label>
      <input id="${id}" ${attrs} required ${error ? 'aria-describedby="login-error"' : ''}>
    </div>`;
  return `
  <main class="login">
    <div class="card login-card">
      <div class="login-brand">${icons.wallet}<span>Ça Compte ?</span></div>
      <h1>${esc(t(activating ? 'auth.activateTitle' : 'auth.signInTitle'))}</h1>
      ${activating ? `<p class="muted login-hint">${esc(t('auth.activateHint'))}</p>` : ''}
      <form data-action-submit="${activating ? 'activate' : 'login'}" novalidate>
        ${field('login-username', 'auth.username', 'name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"')}
        ${activating ? `
        ${field('login-code', 'auth.code', 'name="code" autocomplete="one-time-code" autocapitalize="characters" autocorrect="off" spellcheck="false"')}
        ${field('login-new-password', 'auth.newPassword', `name="new-password" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD}"`)}
        ${field('login-confirm-password', 'auth.confirmPassword', `name="confirm-password" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD}"`)}` : `
        ${field('login-password', 'auth.password', 'name="password" type="password" autocomplete="current-password"')}`}
        ${error ? `<p class="login-error" id="login-error" role="alert">${esc(error)}</p>` : ''}
        <button class="btn primary" type="submit" ${busy ? 'disabled' : ''}>${esc(t(activating ? 'auth.activate' : 'auth.signIn'))}</button>
      </form>
      <button class="btn ghost login-switch" type="button" data-action="auth-mode" data-mode="${activating ? 'login' : 'activate'}">
        ${esc(t(activating ? 'auth.backToSignIn' : 'auth.firstTime'))}
      </button>
    </div>
    <button class="btn ghost small login-lang" type="button" data-action="toggle-lang">${icons.globe} ${esc(state.ui.lang === 'en' ? t('common.french') : t('common.english'))}</button>
  </main>`;
}

const value = (id) => document.getElementById(id)?.value ?? '';

function message(err, t) {
  if (err.network) return t('connection.unreachable');
  const key = { bad_credentials: 'badCredentials', bad_code: 'badCode', weak_password: 'weakPassword', missing_fields: 'missingFields' }[err.message];
  return key ? t(`auth.${key}`, { min: MIN_PASSWORD }) : t('common.error');
}

async function submit(t, call) {
  setUi({ authBusy: true, authError: null });
  try {
    const { user } = await call();
    setUi({ authBusy: false, authMode: 'login' });
    await signedIn(user);
  } catch (err) {
    setUi({ authBusy: false, authError: message(err, t) });
  }
}

export const actions = {
  'auth-mode': (el) => setUi({ authMode: el.dataset.mode, authError: null }),
  login: (el, ev, t) => {
    const username = value('login-username').trim();
    const password = value('login-password');
    if (!username || !password) return setUi({ authError: t('auth.missingFields') });
    return submit(t, () => api.login(username, password));
  },
  activate: (el, ev, t) => {
    const username = value('login-username').trim();
    const code = value('login-code').trim();
    const password = value('login-new-password');
    if (!username || !code || !password) return setUi({ authError: t('auth.missingFields') });
    if (password.length < MIN_PASSWORD) return setUi({ authError: t('auth.weakPassword', { min: MIN_PASSWORD }) });
    if (password !== value('login-confirm-password')) return setUi({ authError: t('auth.mismatch') });
    return submit(t, () => api.activate(username, code, password));
  },
};
