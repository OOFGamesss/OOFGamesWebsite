import { walletClient } from '../api/wallet-client.js';
import { hasRecentSession } from '../api/wallet-session.js';
import { connectWalletSocket } from '../api/wallet-live.js';
import { openLoginModal } from './login-modal.js';

const RACE_PATH_PREFIX = '/chocobo-racing/race';
const ACCOUNT_PATH_PREFIX = '/account';
const DEVELOPER_PATH_PREFIX = '/developer';
const CACHE_KEY = 'oof-wallet-pill';

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function fmtGil(n) {
  return `${Number(n || 0).toLocaleString('en-GB')} Gil`;
}

function asAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return undefined;
}

function parseGilText(text) {
  const digits = String(text ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    return raw === 'out' ? null : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function mergeWallet(incoming) {
  if (!incoming) return null;
  const prev = readCache() || {};
  const balance = asAmount(incoming.balance) ?? asAmount(prev.balance);
  const available =
    asAmount(incoming.available) ?? asAmount(incoming.balance) ?? asAmount(prev.available) ?? balance;
  return {
    name: incoming.name ?? prev.name,
    world: incoming.world ?? prev.world,
    balance: balance ?? available,
    available: available ?? balance
  };
}

function writeCache(wallet) {
  try {
    if (wallet) {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          name: wallet.name,
          world: wallet.world,
          balance: wallet.balance,
          available: wallet.available
        })
      );
    } else {
      sessionStorage.setItem(CACHE_KEY, 'out');
    }
  } catch {
    /* storage unavailable */
  }
}

function mountPill() {
  const path = window.location.pathname;
  if (path.startsWith(RACE_PATH_PREFIX) || path.startsWith(DEVELOPER_PATH_PREFIX)) return;
  const onAccountPage = path.startsWith(ACCOUNT_PATH_PREFIX);

  const link = el(
    'a',
    'fixed right-4 top-4 z-50 flex items-center gap-3 rounded-full border border-neon-violet/40 bg-night-deep/92 px-4 py-2 shadow-lg shadow-night-deep/50 transition hover:border-neon-cyan invisible'
  );
  link.href = '/account/';
  link.dataset.accountPill = 'true';
  link.setAttribute('aria-label', 'OOF Games wallet');

  let disconnect = null;
  let signedIn = false;
  let displayedGil = null;
  let gilAnim = null;
  let gilNode = null;
  let identityNode = null;
  let refreshId = 0;

  link.addEventListener('click', (event) => {
    if (signedIn || onAccountPage) return;
    event.preventDefault();
    openLoginModal();
  });

  const cancelGilAnim = () => {
    if (gilAnim) {
      cancelAnimationFrame(gilAnim);
      gilAnim = null;
    }
  };

  const setGilInstant = (value) => {
    cancelGilAnim();
    displayedGil = value;
    if (gilNode) {
      gilNode.textContent = fmtGil(value);
      gilNode.classList.remove('is-up', 'is-down');
    }
  };

  const animateGil = (to) => {
    if (!gilNode) return;
    const target = Math.max(0, Math.floor(Number(to) || 0));
    const from = displayedGil ?? parseGilText(gilNode.textContent);
    if (from == null || from === target) {
      setGilInstant(target);
      return;
    }

    cancelGilAnim();
    const start = performance.now();
    const delta = target - from;
    const dur = Math.min(1100, Math.max(450, 380 + Math.log10(Math.abs(delta) + 1) * 160));
    gilNode.classList.toggle('is-up', delta > 0);
    gilNode.classList.toggle('is-down', delta < 0);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 3;
      const cur = Math.round(from + delta * eased);
      displayedGil = cur;
      gilNode.textContent = fmtGil(cur);
      if (t < 1) {
        gilAnim = requestAnimationFrame(tick);
        return;
      }
      displayedGil = target;
      gilNode.textContent = fmtGil(target);
      gilNode.classList.remove('is-up', 'is-down');
      gilAnim = null;
    };
    gilAnim = requestAnimationFrame(tick);
  };

  const paintSignedOut = () => {
    cancelGilAnim();
    displayedGil = null;
    gilNode = null;
    identityNode = null;
    while (link.firstChild) link.removeChild(link.firstChild);
    link.appendChild(el('span', 'text-base leading-none', '💰'));
    link.appendChild(el('span', 'text-sm font-semibold text-slate-200', 'Sign in'));
  };

  const paintSignedIn = (wallet) => {
    if (!gilNode) {
      while (link.firstChild) link.removeChild(link.firstChild);
      link.appendChild(el('span', 'text-base leading-none', '💰'));
      const details = el('span', 'flex flex-col items-start leading-tight');
      identityNode = el('span', 'text-[11px] text-slate-400');
      gilNode = el('span', 'account-pill__gil text-sm font-bold');
      details.appendChild(identityNode);
      details.appendChild(gilNode);
      link.appendChild(details);
    }
    const identity = [wallet.name, wallet.world].filter(Boolean).join(' · ');
    if (identity) identityNode.textContent = identity;
    animateGil(asAmount(wallet.available) ?? asAmount(wallet.balance) ?? 0);
  };

  const render = (wallet) => {
    signedIn = Boolean(wallet);
    if (!wallet) paintSignedOut();
    else paintSignedIn(wallet);
    link.classList.remove('invisible');
  };

  const onLiveWallet = (wallet) => {
    refreshId += 1;
    const merged = mergeWallet(wallet);
    render(merged);
    writeCache(merged);
    window.dispatchEvent(new CustomEvent('oof-wallet-live', { detail: merged }));
  };

  const startLive = () => {
    if (!disconnect) disconnect = connectWalletSocket(onLiveWallet);
  };

  const stopLive = () => {
    if (disconnect) {
      disconnect();
      disconnect = null;
    }
  };

  const refresh = async () => {
    const id = refreshId;
    const result = await walletClient.getWallet();
    if (id !== refreshId) return;
    if (result.ok) {
      render(result.data);
      writeCache(result.data);
      startLive();
    } else if (result.status === 401 || result.status === 403) {
      render(null);
      writeCache(null);
      stopLive();
    } else if (link.classList.contains('invisible')) {
      render(readCache() ?? null);
    }
  };

  const known = hasRecentSession();
  if (!known) writeCache(null);
  const cached = known ? readCache() : null;
  render(cached ?? null);
  document.body.appendChild(link);
  if (!onAccountPage && known) {
    refresh();
  }
  document.addEventListener('visibilitychange', () => {
    if (onAccountPage) return;
    if (document.visibilityState === 'visible' && !disconnect && hasRecentSession() && readCache()) {
      refresh();
    }
  });
  window.addEventListener('oof-wallet-changed', (event) => {
    refreshId += 1;
    const next = event.detail ? mergeWallet(event.detail) : null;
    render(next);
    writeCache(next);
    if (next) startLive();
    else stopLive();
  });
}

mountPill();
