import { accountClient } from '../api/account-client.js';

function buildContainer() {
  const container = document.createElement('div');
  container.dataset.accountWidget = 'true';
  container.className = 'fixed right-4 top-4 z-50';
  return container;
}

function buildSignedIn(me) {
  const anchor = document.createElement('a');
  anchor.href = '/developer/';
  anchor.setAttribute('aria-label', 'Open your developer dashboard');
  anchor.className =
    'flex items-center gap-2 rounded-full border border-neon-violet/40 bg-night-panel/80 py-1 pl-1 pr-4 backdrop-blur-sm transition hover:border-neon-cyan';

  const avatar = document.createElement('img');
  avatar.src = me.avatar_url;
  avatar.alt = '';
  avatar.referrerPolicy = 'no-referrer';
  avatar.className = 'h-8 w-8 rounded-full object-cover';
  anchor.appendChild(avatar);

  const name = document.createElement('span');
  name.textContent = me.username;
  name.className = 'hidden max-w-40 truncate text-sm font-semibold text-slate-100 sm:inline';
  anchor.appendChild(name);

  return anchor;
}

function buildSignedOut() {
  const anchor = document.createElement('a');
  anchor.href = '/developer/';
  anchor.textContent = 'Developer login';
  anchor.className =
    'rounded-full border border-neon-violet/40 bg-night-panel/80 px-4 py-2 text-sm font-semibold text-slate-300 backdrop-blur-sm transition hover:border-neon-cyan hover:text-neon-cyan';
  return anchor;
}

async function mountWidget() {
  if (document.querySelector('[data-account-widget]')) {
    return;
  }
  const container = buildContainer();
  document.body.appendChild(container);

  const me = await accountClient.getMe();
  container.appendChild(me.ok ? buildSignedIn(me.data) : buildSignedOut());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountWidget);
} else {
  mountWidget();
}
