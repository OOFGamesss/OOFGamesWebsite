import { walletClient } from '../api/wallet-client.js';

const app = document.getElementById('account-app');

const state = {
  wallet: null,
  page: 1,
  filter: null,
  countdownTimer: null
};

const STAKE_STEP = 1000;

function digitsOf(value) {
  return value.replace(/\D/g, '');
}

function groupDigits(value) {
  const digits = digitsOf(value);
  return digits ? Number.parseInt(digits, 10).toLocaleString('en-GB') : '';
}

function gilStepper(placeholder) {
  const wrap = el('span', 'relative inline-flex w-full sm:flex-1');
  const input = el('input', 'w-full rounded-xl border border-neon-violet/30 bg-night-deep/80 px-4 py-2 pr-8 text-slate-100 placeholder-slate-500 focus:border-neon-cyan focus:outline-none');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.placeholder = placeholder;
  input.addEventListener('input', () => {
    input.value = groupDigits(input.value);
  });

  const arrows = el('span', 'absolute bottom-1 right-1 top-1 flex flex-col gap-0.5');
  const step = (direction) => {
    const current = Number.parseInt(digitsOf(input.value), 10) || 0;
    input.value = groupDigits(String(Math.max(0, current + direction * STAKE_STEP)));
  };
  for (const [direction, glyph, label] of [[1, '▲', 'Add 1,000'], [-1, '▼', 'Subtract 1,000']]) {
    const button = el('button', 'grid w-[17px] flex-1 cursor-pointer place-items-center rounded border-none bg-gradient-to-b from-neon-violet to-neon-magenta text-[0.48rem] leading-none text-night-deep shadow transition hover:brightness-125 active:brightness-90', glyph);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => step(direction));
    arrows.appendChild(button);
  }

  wrap.appendChild(input);
  wrap.appendChild(arrows);
  return { wrap, input, amount: () => Number.parseInt(digitsOf(input.value), 10) || 0 };
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function stopCountdown() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
}

function gil(amount) {
  return `${amount.toLocaleString('en-GB')} Gil`;
}

function parseServerDate(value) {
  return new Date(/Z|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

function remainingText(expiresAt) {
  const remaining = Math.floor((parseServerDate(expiresAt) - Date.now()) / 1000);
  if (remaining <= 0) return 'expired';
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function statusLine() {
  return el('p', 'min-h-5 text-sm text-slate-400');
}

function setStatus(node, message, isError = false) {
  node.textContent = message;
  node.classList.toggle('text-red-400', isError);
  node.classList.toggle('text-neon-green', !isError && Boolean(message));
}

function primaryButton(text) {
  const button = el('button', 'btn-primary px-4 py-2 text-sm', text);
  button.type = 'button';
  return button;
}

function subtleButton(text) {
  const button = el('button', 'rounded-xl border border-neon-violet/40 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan', text);
  button.type = 'button';
  return button;
}

function dangerButton(text) {
  const button = el('button', 'rounded-xl border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10', text);
  button.type = 'button';
  return button;
}

function renderLogin(message = '') {
  stopCountdown();
  clear(app);
  const panel = el('section', 'panel mx-auto flex w-full max-w-md flex-col gap-5 p-10 text-center');
  panel.appendChild(el('h2', 'text-2xl font-semibold text-neon-gold', 'Connect your wallet'));
  panel.appendChild(el('p', 'text-sm text-slate-300', 'Enter the account token an OOF Games host gave you in-game.'));

  const input = el('input', 'w-full rounded-xl border border-neon-violet/30 bg-night-deep/80 px-4 py-3 text-center font-mono tracking-widest text-slate-100 placeholder-slate-500 focus:border-neon-cyan focus:outline-none');
  input.type = 'password';
  input.placeholder = 'OOF-XXXX-XXXX-XXXX';
  input.autocomplete = 'off';
  input.spellcheck = false;
  panel.appendChild(input);

  const status = statusLine();
  if (message) setStatus(status, message, true);

  const connect = primaryButton('Connect Wallet');
  const submit = async () => {
    const token = input.value.trim();
    if (!token) {
      setStatus(status, 'Please enter your token.', true);
      return;
    }
    connect.disabled = true;
    setStatus(status, 'Connecting…');
    const result = await walletClient.login(token);
    connect.disabled = false;
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    state.wallet = result.data;
    state.page = 1;
    renderDashboard();
  };
  connect.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });

  panel.appendChild(connect);
  panel.appendChild(status);
  panel.appendChild(el('p', 'text-xs text-slate-500', 'Lost your token? Ask a host in-game to issue you a new one - the old one stops working immediately.'));
  app.appendChild(panel);
}

function balanceCard() {
  const wallet = state.wallet;
  const panel = el('section', 'panel flex flex-col gap-4 p-6');

  const identity = el('div', 'flex items-baseline justify-between gap-3');
  identity.appendChild(el('h2', 'text-xl font-semibold text-slate-100', wallet.name));
  identity.appendChild(el('span', 'text-sm text-slate-400', wallet.world));
  panel.appendChild(identity);

  const balances = el('div', 'grid grid-cols-1 gap-3 sm:grid-cols-2');
  const totalBox = el('div', 'rounded-xl border border-neon-gold/30 bg-night-deep/60 p-4');
  totalBox.appendChild(el('p', 'text-xs uppercase tracking-wide text-slate-400', 'Balance'));
  totalBox.appendChild(el('p', 'text-2xl font-bold text-neon-gold', gil(wallet.balance)));
  const availableBox = el('div', 'rounded-xl border border-neon-cyan/30 bg-night-deep/60 p-4');
  availableBox.appendChild(el('p', 'text-xs uppercase tracking-wide text-slate-400', 'Available'));
  availableBox.appendChild(el('p', 'text-2xl font-bold text-neon-cyan', gil(wallet.available)));
  balances.appendChild(totalBox);
  balances.appendChild(availableBox);
  panel.appendChild(balances);

  return panel;
}

function pendingCard(container) {
  const pending = state.wallet.pending_withdrawal;
  const panel = el('section', 'panel flex flex-col gap-3 border border-neon-gold/40 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-gold', 'Pending withdrawal'));
  panel.appendChild(el('p', 'text-sm text-slate-300', `${gil(pending.amount)} is on hold for cash-out. Give your PIN to a host in-game to complete it.`));

  const countdown = el('p', 'text-sm text-slate-400', `Expires in ${remainingText(pending.expires_at)}`);
  panel.appendChild(countdown);
  stopCountdown();
  state.countdownTimer = setInterval(() => {
    const text = remainingText(pending.expires_at);
    countdown.textContent = `Expires in ${text}`;
    if (text === 'expired') {
      stopCountdown();
      refreshWallet();
    }
  }, 1000);

  const status = statusLine();
  const cancel = dangerButton('Cancel withdrawal');
  cancel.addEventListener('click', async () => {
    cancel.disabled = true;
    const result = await walletClient.cancelWithdrawal();
    cancel.disabled = false;
    if (!result.ok && result.status !== 404) {
      setStatus(status, result.error, true);
      return;
    }
    refreshWallet();
  });
  panel.appendChild(cancel);
  panel.appendChild(status);
  container.appendChild(panel);
}

function withdrawCard(container) {
  const panel = el('section', 'panel flex flex-col gap-3 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'Withdraw Gil'));
  panel.appendChild(el('p', 'text-sm text-slate-300', 'Request a withdrawal PIN, then hand the PIN to a host in-game within 15 minutes. The amount is held from your available balance until it completes, expires or you cancel.'));

  const row = el('div', 'flex flex-col gap-3 sm:flex-row');
  const stepper = gilStepper('Amount in Gil');
  const button = primaryButton('Request PIN');
  row.appendChild(stepper.wrap);
  row.appendChild(button);
  panel.appendChild(row);

  const status = statusLine();
  panel.appendChild(status);

  button.addEventListener('click', async () => {
    const amount = stepper.amount();
    if (!Number.isInteger(amount) || amount <= 0) {
      setStatus(status, 'Enter a whole amount of Gil.', true);
      return;
    }
    button.disabled = true;
    setStatus(status, 'Requesting…');
    const result = await walletClient.requestWithdrawal(amount);
    button.disabled = false;
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    renderPinReveal(result.data);
  });
  container.appendChild(panel);
}

function renderPinReveal(data) {
  stopCountdown();
  clear(app);
  const panel = el('section', 'panel mx-auto flex w-full max-w-md flex-col gap-4 p-10 text-center');
  panel.appendChild(el('h2', 'text-xl font-semibold text-neon-gold', 'Your withdrawal PIN'));
  panel.appendChild(el('p', 'font-mono text-5xl font-black tracking-[0.3em] text-neon-cyan', data.pin));
  panel.appendChild(el('p', 'text-sm text-slate-300', `Tell this PIN to an OOF Games host in-game to collect ${gil(data.amount)}.`));

  const countdown = el('p', 'text-sm text-slate-400', `Expires in ${remainingText(data.expires_at)}`);
  panel.appendChild(countdown);
  state.countdownTimer = setInterval(() => {
    countdown.textContent = `Expires in ${remainingText(data.expires_at)}`;
  }, 1000);

  panel.appendChild(el('p', 'text-xs text-slate-500', 'This PIN is shown only once - it cannot be viewed again. If you lose it, cancel the withdrawal and request a new one.'));

  const done = primaryButton('Back to wallet');
  done.addEventListener('click', () => refreshWallet());
  panel.appendChild(done);
  app.appendChild(panel);
}

const TYPE_LABELS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  game_spend: 'Game spend',
  game_payout: 'Game payout'
};

const FILTERS = [
  { value: null, label: 'All' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'withdrawal', label: 'Withdrawals' },
  { value: 'game_spend', label: 'Game spends' },
  { value: 'game_payout', label: 'Game payouts' }
];

function historyCard(container) {
  const panel = el('section', 'panel flex flex-col gap-3 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'Transaction history'));

  const chips = el('div', 'flex flex-wrap gap-2');
  const chipButtons = new Map();
  panel.appendChild(chips);

  const list = el('div', 'flex flex-col divide-y divide-neon-violet/10');
  panel.appendChild(list);
  const status = statusLine();
  panel.appendChild(status);

  const pager = el('div', 'flex items-center justify-between');
  const prev = subtleButton('⇠ Newer');
  const pageLabel = el('span', 'text-xs text-slate-500', '');
  const next = subtleButton('Older ⇢');
  pager.appendChild(prev);
  pager.appendChild(pageLabel);
  pager.appendChild(next);
  panel.appendChild(pager);

  const updateChips = () => {
    for (const [value, chip] of chipButtons) {
      const active = value === state.filter;
      chip.classList.toggle('bg-neon-violet/20', active);
      chip.classList.toggle('text-neon-cyan', active);
      chip.classList.toggle('border-neon-cyan/60', active);
      chip.classList.toggle('text-slate-400', !active);
    }
  };

  const load = async () => {
    setStatus(status, 'Loading…');
    const result = await walletClient.getTransactions(state.page, state.filter);
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    setStatus(status, '');
    clear(list);
    if (result.data.transactions.length === 0) {
      list.appendChild(el('p', 'py-4 text-sm text-slate-500', 'No transactions yet - visit a host in-game to make your first deposit.'));
    }
    for (const entry of result.data.transactions) {
      const row = el('div', 'flex items-center justify-between gap-3 py-3');
      const left = el('div');
      left.appendChild(el('p', 'text-sm font-semibold text-slate-200', TYPE_LABELS[entry.transaction_type] || entry.transaction_type));
      const when = parseServerDate(entry.created_at).toLocaleString('en-GB');
      left.appendChild(el('p', 'text-xs text-slate-500', entry.host_name ? `${when} · via ${entry.host_name}` : when));
      const right = el('div', 'text-right');
      const positive = entry.amount > 0;
      right.appendChild(el('p', `text-sm font-bold ${positive ? 'text-neon-green' : 'text-red-400'}`, `${positive ? '+' : ''}${gil(entry.amount)}`));
      right.appendChild(el('p', 'text-xs text-slate-500', `Balance: ${gil(entry.balance_after)}`));
      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    }
    pageLabel.textContent = `Page ${state.page}`;
    prev.disabled = state.page <= 1;
    prev.classList.toggle('opacity-40', prev.disabled);
    next.disabled = !result.data.has_more;
    next.classList.toggle('opacity-40', next.disabled);
  };

  prev.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      load();
    }
  });
  next.addEventListener('click', () => {
    state.page += 1;
    load();
  });

  for (const filter of FILTERS) {
    const chip = el('button', 'rounded-full border border-neon-violet/30 px-3 py-1 text-xs font-semibold transition hover:text-neon-cyan', filter.label);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      state.filter = filter.value;
      state.page = 1;
      updateChips();
      load();
    });
    chipButtons.set(filter.value, chip);
    chips.appendChild(chip);
  }
  updateChips();

  container.appendChild(panel);
  load();
}

function renderDashboard() {
  stopCountdown();
  clear(app);
  app.appendChild(balanceCard());
  if (state.wallet.pending_withdrawal) {
    pendingCard(app);
  } else {
    withdrawCard(app);
  }
  historyCard(app);

  const footer = el('div', 'flex justify-center');
  const logout = el(
    'button',
    'rounded-xl border-2 border-red-500/70 bg-red-500/10 px-8 py-3 text-base font-bold text-red-400 shadow-lg shadow-red-500/20 transition hover:bg-red-500/25 hover:text-red-300',
    'Sign out'
  );
  logout.type = 'button';
  logout.addEventListener('click', async () => {
    await walletClient.logout();
    state.wallet = null;
    renderLogin();
  });
  footer.appendChild(logout);
  app.appendChild(footer);
}

async function refreshWallet() {
  const result = await walletClient.getWallet();
  if (!result.ok) {
    if (result.status === 401) {
      renderLogin();
    }
    return;
  }
  state.wallet = result.data;
  renderDashboard();
}

async function init() {
  const result = await walletClient.getWallet();
  if (result.ok) {
    state.wallet = result.data;
    renderDashboard();
  } else {
    renderLogin();
  }
}

init();
