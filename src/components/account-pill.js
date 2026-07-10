import { walletClient } from '../api/wallet-client.js';

const RACE_PATH_PREFIX = '/chocobo-racing/race';

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function mountPill() {
  if (window.location.pathname.startsWith(RACE_PATH_PREFIX)) return;

  const link = el(
    'a',
    'fixed right-4 top-4 z-50 flex items-center gap-3 rounded-full border border-neon-violet/40 bg-night-deep/85 px-4 py-2 shadow-lg shadow-night-deep/50 backdrop-blur transition hover:border-neon-cyan'
  );
  link.href = '/account/';
  link.setAttribute('aria-label', 'OOF Games wallet');

  const render = (wallet) => {
    while (link.firstChild) link.removeChild(link.firstChild);
    if (!wallet) {
      link.appendChild(el('span', 'text-base leading-none', '💰'));
      link.appendChild(el('span', 'text-sm font-semibold text-slate-200', 'Sign in'));
      return;
    }
    link.appendChild(el('span', 'text-base leading-none', '💰'));
    const details = el('span', 'flex flex-col items-start leading-tight');
    details.appendChild(
      el('span', 'text-[11px] text-slate-400', `${wallet.name} · ${wallet.world}`)
    );
    details.appendChild(
      el('span', 'text-sm font-bold text-neon-gold', `${wallet.balance.toLocaleString('en-GB')} Gil`)
    );
    link.appendChild(details);
  };

  const refresh = async () => {
    const result = await walletClient.getWallet();
    render(result.ok ? result.data : null);
  };

  render(null);
  document.body.appendChild(link);
  refresh();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

mountPill();
