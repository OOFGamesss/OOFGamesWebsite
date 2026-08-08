import { walletClient } from '../api/wallet-client.js';
import { hasRecentSession } from '../api/wallet-session.js';

const DEFAULT_INTRO = 'Enter the account token an OOF Games host gave you in-game.';

let overlay = null;
let card = null;
let intro = null;
let input = null;
let status = null;
let connect = null;
let successHandler = null;
let previousFocus = null;
let openId = 0;

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('text-red-400', isError);
  status.classList.toggle('text-slate-400', !isError);
}

function close() {
  if (!overlay) return;
  overlay.style.display = 'none';
  input.value = '';
  connect.disabled = false;
  setStatus('');
  successHandler = null;
  document.removeEventListener('keydown', onKeydown);
  if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  previousFocus = null;
}

function onKeydown(event) {
  if (event.key === 'Escape') close();
}

async function submit() {
  const token = input.value.trim();
  if (!token) {
    setStatus('Please enter your token.', true);
    return;
  }
  connect.disabled = true;
  setStatus('Connecting…');
  const result = await walletClient.login(token);
  connect.disabled = false;
  if (!result.ok) {
    setStatus(result.error, true);
    input.select();
    return;
  }
  const handler = successHandler;
  close();
  window.dispatchEvent(new CustomEvent('oof-wallet-changed', { detail: result.data }));
  if (handler) handler(result.data);
}

function build() {
  overlay = el('div', 'fixed inset-0 z-[70] flex items-center justify-center px-4');
  overlay.style.display = 'none';
  overlay.style.background = 'rgba(5,3,12,0.78)';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Connect your wallet');
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  card = el('section', 'panel relative flex w-full max-w-sm flex-col gap-4 p-7 text-center');

  const dismiss = el('button', 'absolute right-3 top-3 cursor-pointer border-none bg-transparent text-lg text-slate-400 transition hover:text-neon-cyan', '✕');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Close');
  dismiss.addEventListener('click', close);
  card.appendChild(dismiss);

  card.appendChild(el('h2', 'text-xl font-semibold text-neon-gold', 'Connect your wallet'));

  intro = el('p', 'text-sm text-slate-300', DEFAULT_INTRO);
  card.appendChild(intro);

  input = el('input', 'w-full rounded-xl border border-neon-violet/30 bg-night-deep/80 px-4 py-3 text-center font-mono tracking-widest text-slate-100 placeholder-slate-500 focus:border-neon-cyan focus:outline-none');
  input.type = 'password';
  input.placeholder = 'OOF-XXXX-XXXX-XXXX';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });
  card.appendChild(input);

  connect = el('button', 'btn-primary w-full', 'Connect Wallet');
  connect.type = 'button';
  connect.addEventListener('click', submit);
  card.appendChild(connect);

  status = el('p', 'min-h-5 text-sm text-slate-400');
  card.appendChild(status);

  card.appendChild(el('p', 'text-xs text-slate-500', 'No account yet? Any OOF Games host can register you and take your Gil deposit in-game.'));

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

async function probeExistingSession(id) {
  const result = await walletClient.getWallet();
  if (!result.ok || id !== openId) return;
  if (overlay.style.display === 'none' || connect.disabled || input.value.trim()) return;
  const handler = successHandler;
  close();
  window.dispatchEvent(new CustomEvent('oof-wallet-changed', { detail: result.data }));
  if (handler) handler(result.data);
}

export function openLoginModal({ intro: introText, onSuccess } = {}) {
  if (!overlay) build();
  successHandler = onSuccess || null;
  intro.textContent = introText || DEFAULT_INTRO;
  previousFocus = document.activeElement;
  overlay.style.display = 'flex';
  document.addEventListener('keydown', onKeydown);
  input.focus();
  openId += 1;
  if (!hasRecentSession()) probeExistingSession(openId);
}

export function closeLoginModal() {
  close();
}
