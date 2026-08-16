import { adminClient, adminLoginUrl } from '../api/admin-client.js';

const app = document.getElementById('admin-app');

const state = {
  me: null,
  activeTab: 'overview'
};

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function gil(amount) {
  return `${amount.toLocaleString('en-GB')} Gil`;
}

function parseServerDate(value) {
  return new Date(/Z|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

function when(value) {
  return parseServerDate(value).toLocaleString('en-GB');
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
  const button = el('button', 'rounded-xl border border-neon-violet/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan', text);
  button.type = 'button';
  return button;
}

function dangerButton(text) {
  const button = el('button', 'rounded-xl border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10', text);
  button.type = 'button';
  return button;
}

function textInput(placeholder) {
  const input = el('input', 'w-full rounded-xl border border-neon-violet/30 bg-night-deep/80 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-neon-cyan focus:outline-none');
  input.type = 'text';
  input.placeholder = placeholder;
  return input;
}

function fieldLabel(text) {
  return el('span', '-mb-2 text-xs uppercase tracking-wide text-slate-500', text);
}

function badge(text, tone) {
  const tones = {
    red: 'bg-red-500/15 text-red-400 border-red-500/40',
    gold: 'bg-neon-gold/15 text-neon-gold border-neon-gold/40',
    green: 'bg-neon-green/15 text-neon-green border-neon-green/40',
    slate: 'bg-slate-500/15 text-slate-400 border-slate-500/40'
  };
  return el('span', `rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${tones[tone]}`, text);
}

function tableShell(headers) {
  const wrap = el('div', 'overflow-x-auto');
  const table = el('table', 'w-full text-left text-sm');
  const head = el('thead');
  const headRow = el('tr', 'border-b border-neon-violet/20 text-xs uppercase tracking-wide text-slate-500');
  for (const header of headers) {
    headRow.appendChild(el('th', 'px-3 py-2 font-semibold', header));
  }
  head.appendChild(headRow);
  const body = el('tbody', 'divide-y divide-neon-violet/10');
  table.appendChild(head);
  table.appendChild(body);
  wrap.appendChild(table);
  return { wrap, body };
}

function cell(text, className = 'px-3 py-2 text-slate-300') {
  return el('td', className, text);
}

function pagerRow(onPrev, onNext) {
  const pager = el('div', 'flex items-center justify-between');
  const prev = subtleButton('⇠ Prev');
  const label = el('span', 'text-xs text-slate-500');
  const next = subtleButton('Next ⇢');
  prev.addEventListener('click', onPrev);
  next.addEventListener('click', onNext);
  pager.appendChild(prev);
  pager.appendChild(label);
  pager.appendChild(next);
  return { pager, prev, next, label };
}

function updatePager(pager, page, hasMore) {
  pager.label.textContent = `Page ${page}`;
  pager.prev.disabled = page <= 1;
  pager.prev.classList.toggle('opacity-40', pager.prev.disabled);
  pager.next.disabled = !hasMore;
  pager.next.classList.toggle('opacity-40', pager.next.disabled);
}

function banControls(banType, subjectId, banned, banId, onDone, status) {
  const holder = el('span', 'inline-flex items-center gap-2');
  if (banned) {
    const unban = subtleButton('Unban');
    unban.addEventListener('click', async () => {
      unban.disabled = true;
      let id = banId;
      if (id == null) {
        const bans = await adminClient.getBans();
        id = bans.ok
          ? bans.data.find((b) => b.ban_type === banType && b.subject_id === subjectId)?.id
          : null;
      }
      const result = id != null ? await adminClient.removeBan(id) : { ok: false, error: 'Ban not found' };
      if (!result.ok) {
        unban.disabled = false;
        if (status) setStatus(status, result.error, true);
        return;
      }
      onDone();
    });
    holder.appendChild(unban);
    return holder;
  }
  const banButton = dangerButton('Ban');
  banButton.addEventListener('click', () => {
    clear(holder);
    const reason = textInput('Reason');
    reason.className += ' w-40';
    const confirm = dangerButton('Confirm');
    const cancel = subtleButton('✕');
    confirm.addEventListener('click', async () => {
      if (!reason.value.trim()) return;
      confirm.disabled = true;
      const result = await adminClient.createBan(banType, subjectId, reason.value.trim());
      if (!result.ok) {
        confirm.disabled = false;
        if (status) setStatus(status, result.error, true);
        return;
      }
      onDone();
    });
    cancel.addEventListener('click', () => {
      clear(holder);
      holder.appendChild(banButton);
    });
    holder.appendChild(reason);
    holder.appendChild(confirm);
    holder.appendChild(cancel);
    reason.focus();
  });
  holder.appendChild(banButton);
  return holder;
}

function renderLogin() {
  clear(app);
  const panel = el('section', 'panel mx-auto flex w-full max-w-md flex-col items-center gap-5 p-10 text-center');
  panel.appendChild(el('h2', 'text-2xl font-semibold text-neon-gold', 'Sign in required'));
  panel.appendChild(el('p', 'text-sm text-slate-300', 'Log in with Discord to access administration.'));
  const outcome = new URLSearchParams(window.location.search).get('login');
  if (outcome === 'error') {
    panel.appendChild(el('p', 'text-sm text-red-400', 'Login failed, please try again.'));
  }
  if (outcome === 'banned') {
    panel.appendChild(el('p', 'text-sm text-red-400', 'This account is banned.'));
  }
  const login = el('a', 'btn-primary', 'Login with Discord');
  login.href = adminLoginUrl;
  panel.appendChild(login);
  app.appendChild(panel);
}

function renderDenied() {
  clear(app);
  const panel = el('section', 'panel mx-auto flex w-full max-w-md flex-col items-center gap-4 p-10 text-center');
  panel.appendChild(el('h2', 'text-2xl font-semibold text-red-400', 'Administrator access required'));
  panel.appendChild(el('p', 'text-sm text-slate-300', 'Your account does not have administrator permissions.'));
  app.appendChild(panel);
}

function statCard(label, value, accent = 'text-neon-cyan') {
  const card = el('div', 'rounded-xl border border-neon-violet/25 bg-night-deep/60 p-4');
  card.appendChild(el('p', 'text-xs uppercase tracking-wide text-slate-500', label));
  card.appendChild(el('p', `mt-1 text-xl font-bold ${accent}`, value));
  return card;
}

function chestAdjustBox(summary, onDone) {
  const box = el('div', 'flex flex-col gap-3 rounded-xl border border-neon-violet/25 bg-night-deep/60 p-4');
  box.appendChild(el('h4', 'text-sm font-semibold text-neon-gold', 'Adjust gil in chest'));
  box.appendChild(
    el('p', 'text-xs text-slate-500', 'For gil physically added to or taken out of the chest outside deposits and withdrawals. Player balances are untouched, so house profit held moves by the same amount.')
  );

  const modeSelect = el('select', 'neon-select');
  for (const [value, label] of [['delta', 'Adjust by'], ['total', 'Set chest total to']]) {
    const option = el('option', '', label);
    option.value = value;
    modeSelect.appendChild(option);
  }
  const amountInput = textInput('Amount (negative to remove)');
  amountInput.type = 'number';
  const noteInput = textInput('Reason (required, goes in the audit log)');
  const preview = el('p', 'text-xs text-slate-400');
  const adjustStatus = statusLine();
  const applyButton = primaryButton('Apply adjustment');

  const delta = () => {
    const value = Number(amountInput.value);
    if (amountInput.value.trim() === '' || !Number.isInteger(value)) return null;
    return modeSelect.value === 'total' ? value - summary.chest_gil : value;
  };

  const refreshPreview = () => {
    const change = delta();
    if (change === null || change === 0) {
      preview.textContent = modeSelect.value === 'total'
        ? `Chest currently holds ${gil(summary.chest_gil)}.`
        : '';
      return;
    }
    const verb = change > 0 ? 'Adds' : 'Removes';
    preview.textContent = `${verb} ${gil(Math.abs(change))}, leaving ${gil(summary.chest_gil + change)} in the chest.`;
  };

  modeSelect.addEventListener('change', () => {
    amountInput.placeholder = modeSelect.value === 'total' ? 'New chest total' : 'Amount (negative to remove)';
    amountInput.value = modeSelect.value === 'total' ? String(summary.chest_gil) : '';
    refreshPreview();
  });
  amountInput.addEventListener('input', refreshPreview);
  refreshPreview();

  applyButton.addEventListener('click', async () => {
    const change = delta();
    const note = noteInput.value.trim();
    if (change === null || !note) {
      setStatus(adjustStatus, 'Enter a whole amount and a reason.', true);
      return;
    }
    if (change === 0) {
      setStatus(adjustStatus, 'That leaves the chest unchanged.', true);
      return;
    }
    applyButton.disabled = true;
    const payload = modeSelect.value === 'total'
      ? { target_total: Number(amountInput.value), note }
      : { amount: change, note };
    const outcome = await adminClient.adjustChest(payload);
    applyButton.disabled = false;
    if (!outcome.ok) {
      setStatus(adjustStatus, outcome.error, true);
      return;
    }
    onDone();
  });

  box.appendChild(modeSelect);
  box.appendChild(amountInput);
  box.appendChild(noteInput);
  box.appendChild(preview);
  box.appendChild(applyButton);
  box.appendChild(adjustStatus);
  return box;
}

function chestAdjustmentsTable(adjustments) {
  const { wrap, body } = tableShell(['When', 'Change', 'Chest after', 'Reason', 'By']);
  if (adjustments.length === 0) {
    body.appendChild(el('tr')).appendChild(cell('No manual adjustments yet'));
  }
  for (const row of adjustments) {
    const tr = el('tr');
    tr.appendChild(cell(when(row.created_at)));
    tr.appendChild(
      cell(
        `${row.amount > 0 ? '+' : '-'}${gil(Math.abs(row.amount))}`,
        `px-3 py-2 font-semibold ${row.amount > 0 ? 'text-neon-green' : 'text-red-400'}`
      )
    );
    tr.appendChild(cell(gil(row.chest_after), 'px-3 py-2 text-neon-gold'));
    tr.appendChild(cell(row.note));
    tr.appendChild(cell(row.created_by_name));
    body.appendChild(tr);
  }
  return wrap;
}

async function renderOverview(container) {
  const panel = el('section', 'panel flex flex-col gap-5 p-6');
  const status = statusLine();
  panel.appendChild(status);
  const content = el('div', 'flex flex-col gap-5');
  panel.appendChild(content);
  container.appendChild(panel);

  const load = async () => {
    setStatus(status, 'Loading…');
    const result = await adminClient.getSummary();
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    setStatus(status, '');
    clear(content);
    const s = result.data;

    const cards = el('div', 'grid grid-cols-2 gap-3 md:grid-cols-4');
    cards.appendChild(statCard('Gil in chest', gil(s.chest_gil), 'text-neon-gold'));
    cards.appendChild(statCard('Owed to players', gil(s.total_balance)));
    cards.appendChild(statCard('House profit held', gil(s.house_profit), s.house_profit >= 0 ? 'text-neon-green' : 'text-red-400'));
    cards.appendChild(statCard('Active holds', gil(s.total_holds)));
    cards.appendChild(statCard('Players', String(s.player_count)));
    cards.appendChild(statCard('Ledger entries', String(s.ledger_entries)));
    cards.appendChild(statCard('Deposited 24h', gil(s.deposited_24h), 'text-neon-green'));
    cards.appendChild(statCard('Withdrawn 24h', gil(s.withdrawn_24h), 'text-red-400'));
    cards.appendChild(statCard('Deposited 7d', gil(s.deposited_7d), 'text-neon-green'));
    cards.appendChild(statCard('Withdrawn 7d', gil(s.withdrawn_7d), 'text-red-400'));
    content.appendChild(cards);

    const cacheLine = el(
      'p',
      'text-xs text-slate-500',
      `Host keys active: ${s.host_cache_active_keys} · sheet last synced: ${s.host_cache_last_success ? when(s.host_cache_last_success) : 'never'} · transactions in last 24h: ${s.transactions_24h}`
    );
    content.appendChild(cacheLine);

    content.appendChild(chestAdjustBox(s, load));

    content.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'Manual chest adjustments'));
    content.appendChild(
      el('p', 'text-xs text-slate-500', `Net effect on the chest so far: ${gil(s.chest_adjustment_total)}.`)
    );
    content.appendChild(chestAdjustmentsTable(s.chest_adjustments));

    content.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'Top balances'));
    const { wrap, body } = tableShell(['Player', 'World', 'Balance']);
    if (s.top_balances.length === 0) {
      body.appendChild(el('tr')).appendChild(cell('No balances yet'));
    }
    for (const row of s.top_balances) {
      const tr = el('tr');
      tr.appendChild(cell(row.name, 'px-3 py-2 font-semibold text-slate-200'));
      tr.appendChild(cell(row.world));
      tr.appendChild(cell(gil(row.balance), 'px-3 py-2 text-neon-gold'));
      body.appendChild(tr);
    }
    content.appendChild(wrap);
  };

  await load();
}

async function renderGames(container) {
  const panel = el('section', 'panel flex flex-col gap-5 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'House game profits'));
  panel.appendChild(
    el('p', 'text-xs text-slate-500', 'Computed from the wallet ledger, so every figure reconciles with the system ledger. Host-run sessions are host money and never appear here.')
  );
  const periods = [['24h', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['all', 'All time']];
  const picker = el('div', 'flex flex-wrap gap-2');
  const status = statusLine();
  const results = el('div', 'flex flex-col gap-8');
  const buttons = new Map();
  let period = '7d';

  const load = async () => {
    for (const [id, button] of buttons) {
      button.classList.toggle('border-neon-cyan', id === period);
      button.classList.toggle('text-neon-cyan', id === period);
    }
    setStatus(status, 'Loading…');
    const result = await adminClient.getGamesProfit(period);
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    setStatus(status, '');
    clear(results);
    if (result.data.games.length === 0) {
      results.appendChild(el('p', 'text-sm text-slate-500', 'No game activity in this period.'));
    }
    for (const game of result.data.games) {
      const box = el('div', 'flex flex-col gap-3');
      box.appendChild(el('h4', 'text-base font-semibold text-neon-gold', game.label));
      const cards = el('div', 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6');
      cards.appendChild(statCard('Staked', gil(game.staked)));
      cards.appendChild(statCard('Paid out', gil(game.paid_out), 'text-red-400'));
      cards.appendChild(statCard('Refunded', gil(game.refunded), 'text-slate-300'));
      cards.appendChild(statCard('Net profit', gil(game.net_profit), game.net_profit >= 0 ? 'text-neon-green' : 'text-red-400'));
      cards.appendChild(statCard('Bets', String(game.bets)));
      cards.appendChild(statCard('Bettors', String(game.unique_players)));
      box.appendChild(cards);
      box.appendChild(el('p', 'text-xs uppercase tracking-wide text-slate-500', 'Top players by amount staked'));
      const { wrap, body } = tableShell(['Player', 'World', 'Bets', 'Staked', 'Returned', 'Player net']);
      if (game.top_players.length === 0) {
        body.appendChild(el('tr')).appendChild(cell('No bets in this period'));
      }
      for (const p of game.top_players) {
        const tr = el('tr');
        tr.appendChild(cell(p.name, 'px-3 py-2 font-semibold text-slate-200'));
        tr.appendChild(cell(p.world));
        tr.appendChild(cell(String(p.bets)));
        tr.appendChild(cell(gil(p.staked), 'px-3 py-2 text-neon-gold'));
        tr.appendChild(cell(gil(p.returned)));
        tr.appendChild(
          cell(
            `${p.net > 0 ? '+' : ''}${gil(p.net)}`,
            `px-3 py-2 font-bold ${p.net >= 0 ? 'text-neon-green' : 'text-red-400'}`
          )
        );
        body.appendChild(tr);
      }
      box.appendChild(wrap);
      results.appendChild(box);
    }
  };

  for (const [id, label] of periods) {
    const button = subtleButton(label);
    button.addEventListener('click', () => {
      period = id;
      load();
    });
    buttons.set(id, button);
    picker.appendChild(button);
  }
  panel.appendChild(picker);
  panel.appendChild(status);
  panel.appendChild(results);
  container.appendChild(panel);
  load();
}

const LOTTERY_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LOTTERY_TIERS = {
  0: 'Jackpot (4 + Bonus)',
  1: 'Match 4',
  2: 'Match 3 + Bonus',
  3: 'Match 3',
  4: 'Match 2 + Bonus'
};
const LOTTERY_POT_TYPES = {
  ticket_contribution: 'Ticket contribution',
  fixed_prize: 'Fixed prize',
  jackpot_payout: 'Jackpot payout',
  admin_adjust: 'Admin adjustment'
};

function lotteryBalls(mains, bonus) {
  const holder = el('span', 'font-mono text-sm text-slate-200');
  holder.textContent = mains && mains.length ? `${mains.join(' - ')} + ${bonus}` : '-';
  return holder;
}

async function renderLottery(container) {
  const panel = el('section', 'panel flex flex-col gap-6 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'Eorzea Lottery'));
  const status = statusLine();
  panel.appendChild(status);
  const content = el('div', 'flex flex-col gap-6');
  panel.appendChild(content);
  container.appendChild(panel);

  const load = async () => {
    setStatus(status, 'Loading…');
    const result = await adminClient.getLottery();
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    setStatus(status, '');
    clear(content);
    const data = result.data;

    const cards = el('div', 'grid grid-cols-2 gap-3 md:grid-cols-4');
    cards.appendChild(statCard('True pot balance', gil(data.pot), data.pot >= 0 ? 'text-neon-gold' : 'text-red-400'));
    cards.appendChild(statCard('Public jackpot', gil(data.display_pot), 'text-neon-gold'));
    cards.appendChild(statCard('Tickets this draw', String(data.current.ticket_count)));
    cards.appendChild(
      statCard('Sales', data.current.sales_open ? 'Open' : 'Closed', data.current.sales_open ? 'text-neon-green' : 'text-red-400')
    );
    content.appendChild(cards);
    if (data.pot < 0) {
      content.appendChild(
        el('p', 'text-xs text-red-400', 'The pot is in deficit: future ticket contributions refill it before anything rolls to a jackpot winner. The public site shows 0.')
      );
    }

    const forms = el('div', 'grid gap-4 lg:grid-cols-3');

    const adjustBox = el('div', 'flex flex-col gap-3 rounded-xl border border-neon-violet/25 bg-night-deep/60 p-4');
    adjustBox.appendChild(el('h4', 'text-sm font-semibold text-neon-gold', 'Adjust pot'));
    const amountInput = textInput('Amount (negative to remove)');
    amountInput.type = 'number';
    const noteInput = textInput('Reason (required, goes in the audit log)');
    const adjustStatus = statusLine();
    const adjustButton = primaryButton('Apply adjustment');
    adjustButton.addEventListener('click', async () => {
      const amount = Number(amountInput.value);
      const note = noteInput.value.trim();
      if (!Number.isInteger(amount) || amount === 0 || !note) {
        setStatus(adjustStatus, 'Enter a non-zero whole amount and a reason.', true);
        return;
      }
      adjustButton.disabled = true;
      const outcome = await adminClient.adjustLotteryPot(amount, note);
      adjustButton.disabled = false;
      if (!outcome.ok) {
        setStatus(adjustStatus, outcome.error, true);
        return;
      }
      load();
    });
    adjustBox.appendChild(amountInput);
    adjustBox.appendChild(noteInput);
    adjustBox.appendChild(adjustButton);
    adjustBox.appendChild(adjustStatus);
    forms.appendChild(adjustBox);

    const scheduleBox = el('div', 'flex flex-col gap-3 rounded-xl border border-neon-violet/25 bg-night-deep/60 p-4');
    scheduleBox.appendChild(el('h4', 'text-sm font-semibold text-neon-gold', 'Draw schedule (UTC / ST)'));
    const daySelect = el('select', 'neon-select');
    LOTTERY_WEEKDAYS.forEach((label, index) => {
      const option = el('option', '', label);
      option.value = String(index);
      if (index === data.schedule.draw_weekday) option.selected = true;
      daySelect.appendChild(option);
    });
    const timeInput = textInput('HH:MM');
    timeInput.value = data.schedule.draw_time_utc;
    const closeInput = textInput('Sales close (minutes before)');
    closeInput.type = 'number';
    closeInput.value = String(data.schedule.sales_close_minutes);
    const scheduleStatus = statusLine();
    const scheduleButton = primaryButton('Save schedule');
    scheduleButton.addEventListener('click', async () => {
      scheduleButton.disabled = true;
      const outcome = await adminClient.updateLotterySchedule({
        draw_weekday: Number(daySelect.value),
        draw_time_utc: timeInput.value.trim(),
        sales_close_minutes: Number(closeInput.value)
      });
      scheduleButton.disabled = false;
      if (!outcome.ok) {
        setStatus(scheduleStatus, outcome.error, true);
        return;
      }
      load();
    });
    scheduleBox.appendChild(fieldLabel('Draw day'));
    scheduleBox.appendChild(daySelect);
    scheduleBox.appendChild(fieldLabel('Draw time (HH:MM, UTC)'));
    scheduleBox.appendChild(timeInput);
    scheduleBox.appendChild(fieldLabel('Ticket sales close (minutes before the draw)'));
    scheduleBox.appendChild(closeInput);
    scheduleBox.appendChild(scheduleButton);
    scheduleBox.appendChild(scheduleStatus);

    scheduleBox.appendChild(el('div', 'border-t border-neon-violet/20'));
    scheduleBox.appendChild(el('h4', 'text-sm font-semibold text-neon-gold', `One-off: draw #${data.current.draw_id}`));
    scheduleBox.appendChild(
      el('p', 'text-xs text-slate-500', `Currently ${when(data.current.scheduled_at)}. Move this draw to an exact date, or push it back a week if you are busy. Sold tickets stay valid either way; the weekly schedule resumes after it settles.`)
    );
    const moveInput = textInput('');
    moveInput.type = 'datetime-local';
    moveInput.value = String(data.current.scheduled_at).slice(0, 16);
    const moveStatus = statusLine();
    const moveButton = primaryButton('Move draw');
    moveButton.addEventListener('click', async () => {
      if (!moveInput.value) {
        setStatus(moveStatus, 'Pick a date and time first.', true);
        return;
      }
      moveButton.disabled = true;
      const outcome = await adminClient.moveLotteryDraw(data.current.draw_id, moveInput.value);
      moveButton.disabled = false;
      if (!outcome.ok) {
        setStatus(moveStatus, outcome.error, true);
        return;
      }
      load();
    });
    const skipButton = subtleButton('Push back one week');
    skipButton.addEventListener('click', async () => {
      skipButton.disabled = true;
      const outcome = await adminClient.skipLotteryDraw(data.current.draw_id);
      skipButton.disabled = false;
      if (!outcome.ok) {
        setStatus(moveStatus, outcome.error, true);
        return;
      }
      load();
    });
    scheduleBox.appendChild(fieldLabel('New date & time (UTC / ST)'));
    scheduleBox.appendChild(moveInput);
    const moveRow = el('div', 'flex items-center gap-2');
    moveRow.appendChild(moveButton);
    moveRow.appendChild(skipButton);
    scheduleBox.appendChild(moveRow);
    scheduleBox.appendChild(moveStatus);
    forms.appendChild(scheduleBox);

    const drawBox = el('div', 'flex flex-col gap-3 rounded-xl border border-neon-violet/25 bg-night-deep/60 p-4');
    drawBox.appendChild(el('h4', 'text-sm font-semibold text-neon-gold', 'Manual draw entry (fallback)'));
    drawBox.appendChild(
      el('p', 'text-xs text-slate-500', `Draw #${data.current.draw_id} · ${when(data.current.scheduled_at)}. Normally the host submits via the plugin; use this only if that fails. Settlement pays winners immediately.`)
    );
    const numbersInput = textInput('4 main numbers, e.g. 3 7 11 15');
    const bonusInput = textInput('Bonus ball (1-5)');
    bonusInput.type = 'number';
    const drawStatus = statusLine();
    const drawButton = dangerButton('Submit official result');
    drawButton.addEventListener('click', async () => {
      const mains = numbersInput.value.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
      const bonus = Number(bonusInput.value);
      if (mains.length !== 4 || new Set(mains).size !== 4 || mains.some((n) => n < 1 || n > 15) || bonus < 1 || bonus > 5) {
        setStatus(drawStatus, 'Enter 4 unique mains (1-15) and a bonus (1-5).', true);
        return;
      }
      if (data.current.sales_open) {
        setStatus(drawStatus, 'Sales are still open: the draw cannot be settled yet.', true);
        return;
      }
      drawButton.disabled = true;
      const outcome = await adminClient.submitLotteryDraw(data.current.draw_id, mains, bonus);
      drawButton.disabled = false;
      if (!outcome.ok) {
        setStatus(drawStatus, outcome.error, true);
        return;
      }
      load();
    });
    drawBox.appendChild(numbersInput);
    drawBox.appendChild(bonusInput);
    drawBox.appendChild(drawButton);
    drawBox.appendChild(drawStatus);
    forms.appendChild(drawBox);

    content.appendChild(forms);

    content.appendChild(el('h4', 'text-base font-semibold text-neon-gold', 'Draw history'));
    const draws = tableShell(['Draw', 'Scheduled', 'Status', 'Numbers', 'Tickets', 'Sales', 'House cut', 'Fixed prizes', 'Jackpot', 'Pot after', 'By']);
    for (const draw of data.draws) {
      const tr = el('tr');
      tr.appendChild(cell(`#${draw.draw_id}`, 'px-3 py-2 font-semibold text-slate-200'));
      tr.appendChild(cell(when(draw.scheduled_at), 'px-3 py-2 text-xs text-slate-500'));
      const statusCell = el('td', 'px-3 py-2');
      statusCell.appendChild(badge(draw.status, draw.status === 'settled' ? 'green' : 'gold'));
      tr.appendChild(statusCell);
      const numbersCell = el('td', 'px-3 py-2');
      numbersCell.appendChild(lotteryBalls(draw.main_numbers, draw.bonus_number));
      tr.appendChild(numbersCell);
      tr.appendChild(cell(String(draw.ticket_count)));
      tr.appendChild(cell(gil(draw.sales_total), 'px-3 py-2 text-neon-gold'));
      tr.appendChild(cell(gil(draw.house_cut), 'px-3 py-2 text-neon-green'));
      tr.appendChild(cell(gil(draw.fixed_prizes_paid), 'px-3 py-2 text-red-400'));
      tr.appendChild(
        cell(
          draw.jackpot_winner_count > 0 ? `${gil(draw.jackpot_paid)} (${draw.jackpot_winner_count})` : '-',
          'px-3 py-2 text-neon-gold'
        )
      );
      tr.appendChild(cell(draw.status === 'settled' ? gil(draw.pot_after) : '-'));
      tr.appendChild(cell(draw.submitted_by || '-', 'px-3 py-2 text-xs text-slate-500'));
      draws.body.appendChild(tr);
    }
    content.appendChild(draws.wrap);

    if (data.recent_winners.length > 0) {
      content.appendChild(el('h4', 'text-base font-semibold text-neon-gold', 'Recent winners'));
      const winners = tableShell(['Player', 'World', 'Ticket', 'Tier', 'Prize']);
      for (const winner of data.recent_winners) {
        const tr = el('tr');
        tr.appendChild(cell(winner.player_name, 'px-3 py-2 font-semibold text-slate-200'));
        tr.appendChild(cell(winner.player_world));
        const numbersCell = el('td', 'px-3 py-2');
        numbersCell.appendChild(lotteryBalls(winner.main_numbers, winner.bonus_number));
        tr.appendChild(numbersCell);
        tr.appendChild(cell(LOTTERY_TIERS[winner.prize_tier] || String(winner.prize_tier)));
        tr.appendChild(cell(gil(winner.prize_amount), 'px-3 py-2 font-bold text-neon-gold'));
        winners.body.appendChild(tr);
      }
      content.appendChild(winners.wrap);
    }

    content.appendChild(el('h4', 'text-base font-semibold text-neon-gold', 'Pot ledger'));
    const potTable = tableShell(['When', 'Type', 'Amount', 'Draw', 'Note / By']);
    for (const entry of data.pot_entries) {
      const tr = el('tr');
      tr.appendChild(cell(when(entry.created_at), 'px-3 py-2 text-xs text-slate-500'));
      tr.appendChild(cell(LOTTERY_POT_TYPES[entry.entry_type] || entry.entry_type));
      tr.appendChild(
        cell(
          `${entry.amount > 0 ? '+' : ''}${gil(entry.amount)}`,
          `px-3 py-2 font-bold ${entry.amount > 0 ? 'text-neon-green' : 'text-red-400'}`
        )
      );
      tr.appendChild(cell(entry.draw_id ? `#${entry.draw_id}` : '-'));
      tr.appendChild(cell([entry.note, entry.created_by].filter(Boolean).join(' · ') || '-', 'px-3 py-2 text-xs text-slate-500'));
      potTable.body.appendChild(tr);
    }
    content.appendChild(potTable.wrap);
  };

  load();
}

const TYPE_LABELS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  game_spend: 'Game spend',
  game_payout: 'Game payout'
};

async function renderLedger(container) {
  const panel = el('section', 'panel flex flex-col gap-4 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'System ledger'));
  const status = statusLine();
  const { wrap, body } = tableShell(['When', 'Player', 'Type', 'Amount', 'Balance after', 'Host', 'Reference']);
  panel.appendChild(wrap);
  panel.appendChild(status);
  let page = 1;
  const pager = pagerRow(
    () => {
      if (page > 1) {
        page -= 1;
        load();
      }
    },
    () => {
      page += 1;
      load();
    }
  );
  panel.appendChild(pager.pager);
  container.appendChild(panel);

  const load = async () => {
    setStatus(status, 'Loading…');
    const result = await adminClient.getLedger(page);
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    setStatus(status, '');
    clear(body);
    for (const entry of result.data.transactions) {
      const tr = el('tr');
      tr.appendChild(cell(when(entry.created_at), 'px-3 py-2 text-xs text-slate-500'));
      tr.appendChild(cell(entry.player_name, 'px-3 py-2 font-semibold text-slate-200'));
      tr.appendChild(cell(TYPE_LABELS[entry.transaction_type] || entry.transaction_type));
      tr.appendChild(
        cell(
          `${entry.amount > 0 ? '+' : ''}${gil(entry.amount)}`,
          `px-3 py-2 font-bold ${entry.amount > 0 ? 'text-neon-green' : 'text-red-400'}`
        )
      );
      tr.appendChild(cell(gil(entry.balance_after)));
      tr.appendChild(cell(entry.host_name || '-'));
      tr.appendChild(cell(entry.reference || '-', 'px-3 py-2 text-xs text-slate-500'));
      body.appendChild(tr);
    }
    updatePager(pager, page, result.data.has_more);
  };
  load();
}

async function renderPlayers(container) {
  const panel = el('section', 'panel flex flex-col gap-4 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'Players'));
  const search = textInput('Search by name or content ID');
  panel.appendChild(search);
  const status = statusLine();
  const { wrap, body } = tableShell(['Player', 'World', 'Balance', 'Available', 'Token', 'Status', 'Actions']);
  panel.appendChild(wrap);
  const detailHolder = el('div');
  panel.appendChild(detailHolder);
  panel.appendChild(status);
  let page = 1;
  const pager = pagerRow(
    () => {
      if (page > 1) {
        page -= 1;
        load();
      }
    },
    () => {
      page += 1;
      load();
    }
  );
  panel.appendChild(pager.pager);
  container.appendChild(panel);

  const showDetail = async (contentId) => {
    clear(detailHolder);
    const box = el('div', 'mt-2 rounded-xl border border-neon-cyan/30 bg-night-deep/60 p-4 text-sm text-slate-300');
    box.appendChild(el('p', 'text-slate-400', 'Loading…'));
    detailHolder.appendChild(box);
    const result = await adminClient.getPlayerDetail(contentId);
    clear(box);
    if (!result.ok) {
      box.appendChild(el('p', 'text-red-400', result.error));
      return;
    }
    const d = result.data;
    box.appendChild(el('p', 'font-semibold text-slate-100', `${d.name} · ${d.world} (${d.content_id})`));
    box.appendChild(
      el('p', '', `Balance ${gil(d.balance)} · available ${gil(d.available)} · ${d.session_count} active session(s)`)
    );
    if (d.pending_withdrawal) {
      box.appendChild(
        el('p', 'text-neon-gold', `Pending withdrawal: ${gil(d.pending_withdrawal.amount)} until ${when(d.pending_withdrawal.expires_at)}`)
      );
    }
    for (const entry of d.recent_transactions) {
      box.appendChild(
        el(
          'p',
          'text-xs text-slate-500',
          `${when(entry.created_at)} · ${TYPE_LABELS[entry.transaction_type] || entry.transaction_type} ${entry.amount > 0 ? '+' : ''}${gil(entry.amount)}${entry.host_name ? ` via ${entry.host_name}` : ''}`
        )
      );
    }
  };

  const load = async () => {
    setStatus(status, 'Loading…');
    const result = await adminClient.getPlayers(page, search.value);
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    setStatus(status, '');
    clear(body);
    for (const player of result.data.players) {
      const tr = el('tr', 'cursor-pointer transition hover:bg-neon-violet/5');
      tr.addEventListener('click', () => showDetail(player.content_id));
      tr.appendChild(cell(player.name, 'px-3 py-2 font-semibold text-slate-200'));
      tr.appendChild(cell(player.world));
      tr.appendChild(cell(gil(player.balance), 'px-3 py-2 text-neon-gold'));
      tr.appendChild(cell(gil(player.available)));
      tr.appendChild(cell(player.has_token ? '✓' : '-'));
      const statusCell = el('td', 'px-3 py-2');
      statusCell.appendChild(player.banned ? badge('banned', 'red') : badge('active', 'green'));
      tr.appendChild(statusCell);
      const actions = el('td', 'px-3 py-2');
      actions.addEventListener('click', (event) => event.stopPropagation());
      actions.appendChild(
        banControls('player', player.content_id, player.banned, null, load, status)
      );
      tr.appendChild(actions);
      body.appendChild(tr);
    }
    updatePager(pager, page, result.data.has_more);
  };

  let timer = null;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 1;
      load();
    }, 300);
  });
  load();
}

async function renderDevelopers(container) {
  const panel = el('section', 'panel flex flex-col gap-4 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'Developer accounts'));
  const search = textInput('Search by username or Discord ID');
  panel.appendChild(search);
  const status = statusLine();
  const { wrap, body } = tableShell(['Developer', 'Discord ID', 'Games', 'Joined', 'Status', 'Actions']);
  panel.appendChild(wrap);
  panel.appendChild(status);
  let page = 1;
  const pager = pagerRow(
    () => {
      if (page > 1) {
        page -= 1;
        load();
      }
    },
    () => {
      page += 1;
      load();
    }
  );
  panel.appendChild(pager.pager);
  container.appendChild(panel);

  const load = async () => {
    setStatus(status, 'Loading…');
    const result = await adminClient.getUsers(page, search.value);
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    setStatus(status, '');
    clear(body);
    for (const user of result.data.users) {
      const tr = el('tr');
      const identity = el('td', 'flex items-center gap-2 px-3 py-2');
      const avatar = el('img', 'h-8 w-8 rounded-full border border-neon-violet/40 object-cover');
      avatar.src = user.avatar_url;
      avatar.alt = '';
      avatar.referrerPolicy = 'no-referrer';
      identity.appendChild(avatar);
      identity.appendChild(el('span', 'font-semibold text-slate-200', user.username));
      if (user.is_admin) identity.appendChild(badge('admin', 'gold'));
      tr.appendChild(identity);
      tr.appendChild(cell(user.id, 'px-3 py-2 text-xs text-slate-500'));
      tr.appendChild(cell(String(user.games_count)));
      tr.appendChild(cell(when(user.created_at), 'px-3 py-2 text-xs text-slate-500'));
      const statusCell = el('td', 'px-3 py-2');
      statusCell.appendChild(user.banned ? badge('banned', 'red') : badge('active', 'green'));
      tr.appendChild(statusCell);
      const actions = el('td', 'px-3 py-2');
      if (!user.is_admin) {
        actions.appendChild(banControls('developer', user.id, user.banned, null, load, status));
      }
      tr.appendChild(actions);
      body.appendChild(tr);
    }
    updatePager(pager, page, result.data.has_more);
  };

  let timer = null;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 1;
      load();
    }, 300);
  });
  load();
}

async function renderHosts(container) {
  const panel = el('section', 'panel flex flex-col gap-4 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'Hosts'));
  panel.appendChild(
    el('p', 'text-xs text-slate-500', 'Mirrored from the Google Sheet - manage keys there; changes apply within about a minute.')
  );
  const status = statusLine();
  const { wrap, body } = tableShell(['Host', 'World', 'ID', 'Status', 'Last seen']);
  panel.appendChild(wrap);
  panel.appendChild(status);
  container.appendChild(panel);
  setStatus(status, 'Loading…');
  const result = await adminClient.getHosts();
  if (!result.ok) {
    setStatus(status, result.error, true);
    return;
  }
  setStatus(status, '');
  for (const host of result.data) {
    const tr = el('tr');
    tr.appendChild(cell(host.host_name, 'px-3 py-2 font-semibold text-slate-200'));
    tr.appendChild(cell(host.host_world || '-'));
    tr.appendChild(cell(host.id, 'px-3 py-2 text-xs text-slate-500'));
    const statusCell = el('td', 'px-3 py-2');
    statusCell.appendChild(host.is_active ? badge('active', 'green') : badge('inactive', 'slate'));
    tr.appendChild(statusCell);
    tr.appendChild(cell(when(host.last_seen_at), 'px-3 py-2 text-xs text-slate-500'));
    body.appendChild(tr);
  }
}

async function renderLogs(container) {
  const panel = el('section', 'panel flex flex-col gap-4 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'System logs'));
  const status = statusLine();
  const list = el('div', 'flex flex-col divide-y divide-neon-violet/10');
  panel.appendChild(list);
  panel.appendChild(status);
  let page = 1;
  const pager = pagerRow(
    () => {
      if (page > 1) {
        page -= 1;
        load();
      }
    },
    () => {
      page += 1;
      load();
    }
  );
  panel.appendChild(pager.pager);
  container.appendChild(panel);

  const load = async () => {
    setStatus(status, 'Loading…');
    const result = await adminClient.getLogs(page);
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    setStatus(status, '');
    clear(list);
    if (result.data.logs.length === 0) {
      list.appendChild(el('p', 'py-4 text-sm text-slate-500', 'No log entries.'));
    }
    for (const log of result.data.logs) {
      const row = el('div', 'flex flex-col gap-1 py-3');
      const top = el('div', 'flex items-center justify-between');
      top.appendChild(el('span', 'text-sm font-semibold text-slate-200', log.event_type));
      top.appendChild(el('span', 'text-xs text-slate-500', when(log.timestamp)));
      row.appendChild(top);
      row.appendChild(el('p', 'break-all text-xs text-slate-400', log.details));
      list.appendChild(row);
    }
    updatePager(pager, page, result.data.has_more);
  };
  load();
}

async function renderBans(container) {
  const panel = el('section', 'panel flex flex-col gap-4 p-6');
  panel.appendChild(el('h3', 'text-lg font-semibold text-neon-violet', 'Ban list'));

  const form = el('div', 'flex flex-col gap-2 sm:flex-row');
  const typeSelect = el('select', 'rounded-xl border border-neon-violet/30 bg-night-deep/80 px-3 py-2 text-sm text-slate-100 focus:border-neon-cyan focus:outline-none');
  for (const [value, label] of [['player', 'Player (content ID)'], ['developer', 'Developer (Discord ID)']]) {
    const option = el('option', '', label);
    option.value = value;
    typeSelect.appendChild(option);
  }
  const subjectInput = textInput('Content ID or Discord ID');
  const reasonInput = textInput('Reason');
  const submit = dangerButton('Issue ban');
  submit.className = submit.className.replace('text-xs', 'text-sm');
  form.appendChild(typeSelect);
  form.appendChild(subjectInput);
  form.appendChild(reasonInput);
  form.appendChild(submit);
  panel.appendChild(form);

  const status = statusLine();
  const { wrap, body } = tableShell(['Type', 'Subject', 'Reason', 'Banned by', 'When', '']);
  panel.appendChild(wrap);
  panel.appendChild(status);
  container.appendChild(panel);

  const load = async () => {
    const result = await adminClient.getBans();
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    clear(body);
    if (result.data.length === 0) {
      body.appendChild(el('tr')).appendChild(cell('No active bans'));
    }
    for (const ban of result.data) {
      const tr = el('tr');
      tr.appendChild(cell(ban.ban_type, 'px-3 py-2 text-xs uppercase text-slate-500'));
      tr.appendChild(
        cell(
          ban.subject_name ? `${ban.subject_name} (${ban.subject_id})` : ban.subject_id,
          'px-3 py-2 font-semibold text-slate-200'
        )
      );
      tr.appendChild(cell(ban.reason));
      tr.appendChild(cell(ban.banned_by_name));
      tr.appendChild(cell(when(ban.created_at), 'px-3 py-2 text-xs text-slate-500'));
      const actions = el('td', 'px-3 py-2');
      const unban = subtleButton('Unban');
      unban.addEventListener('click', async () => {
        unban.disabled = true;
        const result = await adminClient.removeBan(ban.id);
        if (!result.ok) {
          unban.disabled = false;
          setStatus(status, result.error, true);
          return;
        }
        setStatus(status, 'Ban lifted.');
        load();
      });
      actions.appendChild(unban);
      tr.appendChild(actions);
      body.appendChild(tr);
    }
  };

  submit.addEventListener('click', async () => {
    const subject = subjectInput.value.trim();
    const reason = reasonInput.value.trim();
    if (!subject || !reason) {
      setStatus(status, 'Subject ID and reason are required.', true);
      return;
    }
    submit.disabled = true;
    const result = await adminClient.createBan(typeSelect.value, subject, reason);
    submit.disabled = false;
    if (!result.ok) {
      setStatus(status, result.error, true);
      return;
    }
    subjectInput.value = '';
    reasonInput.value = '';
    setStatus(status, 'Ban issued.');
    load();
  });

  load();
}

const TABS = [
  { id: 'overview', label: 'Overview', render: renderOverview },
  { id: 'games', label: 'Games', render: renderGames },
  { id: 'lottery', label: 'Lottery', render: renderLottery },
  { id: 'ledger', label: 'Ledger', render: renderLedger },
  { id: 'players', label: 'Players', render: renderPlayers },
  { id: 'developers', label: 'Developers', render: renderDevelopers },
  { id: 'hosts', label: 'Hosts', render: renderHosts },
  { id: 'logs', label: 'Logs', render: renderLogs },
  { id: 'bans', label: 'Bans', render: renderBans }
];

function renderShell() {
  clear(app);
  const layout = el('div', 'flex flex-col gap-6 md:flex-row');
  const sidebar = el('aside', 'panel flex h-fit flex-row gap-2 overflow-x-auto p-3 md:w-48 md:flex-col');
  const content = el('section', 'min-w-0 flex-1');
  const buttons = new Map();

  const activate = (tab) => {
    state.activeTab = tab.id;
    for (const [id, button] of buttons) {
      button.classList.toggle('bg-neon-violet/20', id === tab.id);
      button.classList.toggle('text-neon-cyan', id === tab.id);
    }
    clear(content);
    tab.render(content);
  };

  for (const tab of TABS) {
    const button = el('button', 'whitespace-nowrap rounded-xl px-4 py-2 text-left text-sm font-semibold text-slate-200 transition hover:text-neon-cyan', tab.label);
    button.type = 'button';
    button.addEventListener('click', () => activate(tab));
    buttons.set(tab.id, button);
    sidebar.appendChild(button);
  }

  layout.appendChild(sidebar);
  layout.appendChild(content);
  app.appendChild(layout);
  activate(TABS.find((tab) => tab.id === state.activeTab) || TABS[0]);
}

async function init() {
  const result = await adminClient.getMe();
  if (!result.ok) {
    renderLogin();
    return;
  }
  state.me = result.data;
  if (!state.me.is_admin) {
    renderDenied();
    return;
  }
  renderShell();
}

init();
