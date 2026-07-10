import { walletClient } from '../api/wallet-client.js';
import { connectWalletSocket } from '../api/wallet-live.js';

const RACE_PATH_PREFIX = '/chocobo-racing/race';
const CACHE_KEY = 'oof-wallet-pill';

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
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
  if (window.location.pathname.startsWith(RACE_PATH_PREFIX)) return;

  const link = el(
    'a',
    'fixed right-4 top-4 z-50 flex items-center gap-3 rounded-full border border-neon-violet/40 bg-night-deep/85 px-4 py-2 shadow-lg shadow-night-deep/50 backdrop-blur transition hover:border-neon-cyan invisible'
  );
  link.href = '/account/';
  link.setAttribute('aria-label', 'OOF Games wallet');

  let disconnect = null;

  const render = (wallet) => {
    while (link.firstChild) link.removeChild(link.firstChild);
    link.appendChild(el('span', 'text-base leading-none', '💰'));
    if (!wallet) {
      link.appendChild(el('span', 'text-sm font-semibold text-slate-200', 'Sign in'));
    } else {
      const details = el('span', 'flex flex-col items-start leading-tight');
      details.appendChild(el('span', 'text-[11px] text-slate-400', `${wallet.name} · ${wallet.world}`));
      details.appendChild(
        el(
          'span',
          'text-sm font-bold text-neon-gold',
          `${(wallet.available ?? wallet.balance).toLocaleString('en-GB')} Gil`
        )
      );
      link.appendChild(details);
    }
    link.classList.remove('invisible');
  };

  const onLiveWallet = (wallet) => {
    render(wallet);
    writeCache(wallet);
    window.dispatchEvent(new CustomEvent('oof-wallet-live', { detail: wallet }));
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
    const result = await walletClient.getWallet();
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

  const cached = readCache();
  if (cached !== undefined) render(cached);
  document.body.appendChild(link);
  refresh();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !disconnect) refresh();
  });
  window.addEventListener('oof-wallet-changed', (event) => {
    render(event.detail);
    writeCache(event.detail);
    if (event.detail) startLive();
    else stopLive();
  });
}

mountPill();
