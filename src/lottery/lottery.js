// Eorzea Lottery page controller: renders the current draw (pot, countdown,
// prize table), the number picker and basket for wallet purchases, the
// player's tickets, past results, pick-a-number statistics and the canvas
// draw machine. A WebSocket on /lottery/ws nudges the page the instant the
// draw state changes (live balls, settlement, sales, schedule), with the
// /lottery/current polling kept as a fallback; when the open draw changes
// while watching, the machine re-enacts the new result with full suspense,
// otherwise the latest result is parked instantly.

import { lotteryClient } from '../api/lottery-client.js';
import { apiBaseUrl, walletClient } from '../api/wallet-client.js';
import { hasRecentSession } from '../api/wallet-session.js';
import { openLoginModal } from '../components/login-modal.js';
import { createDrawMachine } from './draw-machine.js';
import lotteryAudio from './lottery-audio.js';

const POLL_IDLE_MS = 60_000;
const POLL_HOT_MS = 10_000;
const POLL_LIVE_MS = 6_000;
const MAIN_COUNT = 4;

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const gil = (value) => `${Number(value).toLocaleString('en-GB')} gil`;

function parseUtc(value) {
  if (!value) return null;
  return new Date(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function infotip(label, text) {
  const button = el('button', 'infotip', '?');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.dataset.infotip = text;
  return button;
}

function wireInfotips() {
  const bubble = el('div', 'infotip-bubble hidden');
  bubble.id = 'infotip-bubble';
  bubble.setAttribute('role', 'tooltip');
  document.body.appendChild(bubble);
  let active = null;

  const hide = () => {
    if (!active) return;
    active.removeAttribute('aria-describedby');
    active = null;
    bubble.classList.add('hidden');
  };

  const show = (button) => {
    if (active === button) return;
    hide();
    active = button;
    bubble.textContent = button.dataset.infotip;
    bubble.style.left = '0px';
    bubble.style.top = '-9999px';
    bubble.classList.remove('hidden');
    button.setAttribute('aria-describedby', 'infotip-bubble');
    const anchor = button.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - bubble.offsetWidth - margin);
    const centred = anchor.left + anchor.width / 2 - bubble.offsetWidth / 2;
    const above = anchor.top > bubble.offsetHeight + margin * 2;
    bubble.style.left = `${Math.min(Math.max(margin, centred), maxLeft)}px`;
    bubble.style.top = `${above ? anchor.top - bubble.offsetHeight - margin : anchor.bottom + margin}px`;
  };

  const tipFor = (event) => event.target.closest?.('[data-infotip]') || null;

  document.addEventListener('pointerover', (event) => {
    const button = tipFor(event);
    if (button) show(button);
    else if (event.pointerType === 'mouse') hide();
  });
  document.addEventListener('focusin', (event) => {
    const button = tipFor(event);
    if (button) show(button);
    else hide();
  });
  document.addEventListener('click', (event) => {
    const button = tipFor(event);
    if (button) show(button);
    else hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
}

function ballChip(number, { bonus = false, hit = false } = {}) {
  return el('span', `ball${bonus ? ' ball--bonus' : ''}${hit ? ' ball--hit' : ''}`, String(number));
}

function ballRow(mains, bonus, drawn = null) {
  const row = el('span', 'ball-row');
  for (const number of mains) {
    row.appendChild(ballChip(number, { hit: drawn ? drawn.mains.includes(number) : false }));
  }
  row.appendChild(el('span', 'ball-plus', '+'));
  row.appendChild(ballChip(bonus, { bonus: true, hit: drawn ? drawn.bonus === bonus : false }));
  return row;
}

const state = {
  current: null,
  signedIn: false,
  pickedMains: new Set(),
  pickedBonus: null,
  basket: [],
  historyPage: 1,
  machine: null,
  pollTimer: null,
  machineDraw: null,
  myCurrent: [],
  myTicketsByDraw: new Map(),
  winnersByDraw: new Map(),
  winnerPopupFor: null,
  winnerPopupDismissed: null,
  winnerPopupTimer: null,
  winnerPopupWaiter: null,
  machineResetTimer: null
};


function renderHeader() {
  const data = state.current;
  $('stat-pot').textContent = gil(data.pot);
  $('stat-tickets').textContent = Number(data.ticket_count).toLocaleString('en-GB');
  $('stat-price').textContent = gil(data.ticket_price);
  for (const node of document.querySelectorAll('[data-price-text]')) {
    node.textContent = Number(data.ticket_price).toLocaleString('en-GB');
  }
  const scheduled = parseUtc(data.scheduled_at);
  const closeAt = parseUtc(data.sales_close_at);
  const minutes = Math.max(1, Math.round((scheduled - closeAt) / 60_000));
  for (const node of document.querySelectorAll('[data-close-text]')) {
    node.textContent = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  $('header-sub').textContent = `Draw #${data.draw_id} · ${scheduled.toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })}`;
}

function tickCountdown() {
  const data = state.current;
  if (!data) return;
  const target = parseUtc(data.sales_open ? data.sales_close_at : data.scheduled_at);
  const remaining = target - Date.now();
  const node = $('stat-countdown');
  if (!data.sales_open) {
    node.textContent = remaining > 0 ? 'Soon…' : 'Drawing…';
    return;
  }
  if (remaining <= 0) {
    node.textContent = 'Closing…';
    refreshCurrent();
    return;
  }
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  node.textContent = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m ${secs}s`;
}


function renderPrizes() {
  const rows = $('prize-rows');
  rows.replaceChildren();
  for (const tier of state.current.prize_tiers) {
    const row = el('tr');
    row.appendChild(el('td', tier.tier === 0 ? 'prize-jackpot' : '', tier.label));
    const amount = el('td', `prize-amount${tier.tier === 0 ? ' prize-jackpot' : ''}`);
    amount.textContent = tier.amount === null ? gil(state.current.pot) : gil(tier.amount);
    if (tier.amount === null) {
      amount.appendChild(infotip(
        'How the jackpot payout is worked out',
        'This is the pool as it stands right now. The fixed prizes below are paid out of it first, so the jackpot winner receives whatever is left.'
      ));
    }
    row.appendChild(amount);
    rows.appendChild(row);
  }
}


function setOverlay(show, content) {
  const overlay = $('machine-overlay');
  overlay.classList.toggle('hidden', !show);
  if (!show) return;
  if (typeof content === 'string') {
    const message = el('p', '', content);
    message.id = 'machine-message';
    overlay.replaceChildren(message);
  } else {
    overlay.replaceChildren(content);
  }
}

function rollingCard(location) {
  const card = el('div', 'rolling-card');
  card.appendChild(el('p', 'rolling-card__title', 'Host is rolling!'));
  const loc = el('div', 'rolling-card__location');
  loc.appendChild(el('span', 'rolling-card__label', 'Location'));
  loc.appendChild(el('span', 'rolling-card__value', location));
  card.appendChild(loc);
  card.appendChild(el('p', 'rolling-card__luck', 'Good luck!'));
  return card;
}

const MACHINE_SOUNDS = {
  tumble: (detail) => lotteryAudio.setTumble(detail.level, detail.count),
  intake: (detail) => lotteryAudio.setIntake(detail.active),
  'ball-in': () => lotteryAudio.ballIn(),
  capture: () => {
    lotteryAudio.setMachineBusy(true);
    lotteryAudio.capture();
  },
  done: () => lotteryAudio.setMachineBusy(false),
  chute: () => lotteryAudio.chute(),
  tray: () => lotteryAudio.tray(),
  park: (detail) => lotteryAudio.lock(detail.slot, detail.bonus),
  gap: () => lotteryAudio.gap()
};

function setAudioPhase(phase) {
  lotteryAudio.setPhase(phase);
}

function playHitSound(ball) {
  if (!state.signedIn || state.myCurrent.length === 0) return;
  const drawn = state.machine.revealedNumbers();
  let best = 0;
  for (const ticket of state.myCurrent) {
    const holds = ball.bonus
      ? ticket.bonus_number === ball.n
      : ticket.main_numbers.includes(ball.n);
    if (!holds) continue;
    const hits = ticket.main_numbers.filter((number) => drawn.mains.includes(number)).length
      + (drawn.bonus === ticket.bonus_number ? 1 : 0);
    best = Math.max(best, hits);
  }
  if (best > 0) lotteryAudio.hit(best);
}

function playResultSting(result) {
  const mine = state.myTicketsByDraw.get(result.draw_id) || [];
  const myPrize = mine.reduce((sum, ticket) => sum + (ticket.prize_amount ?? 0), 0);
  const myJackpot = mine.some((ticket) => ticket.prize_tier === 0 && (ticket.prize_amount ?? 0) > 0);
  if (myJackpot || result.jackpot_winner_count > 0) {
    lotteryAudio.duckMusic(5);
    lotteryAudio.jackpot();
  } else if (myPrize > 0) {
    lotteryAudio.duckMusic(3);
    lotteryAudio.win();
  } else {
    lotteryAudio.duckMusic(2.5);
    lotteryAudio.noWin();
  }
}

function renderAudioControls() {
  const apply = (button, slider, on, volume, label) => {
    if (button) {
      button.classList.toggle('is-off', !on);
      button.setAttribute('aria-pressed', String(on));
      button.title = `${label}: ${on ? 'on' : 'off'}`;
    }
    if (slider) slider.value = String(Math.round(volume * 100));
  };
  apply($('toggle-music'), $('vol-music'), lotteryAudio.musicOn, lotteryAudio.musicVol, 'Music');
  apply($('toggle-sfx'), $('vol-sfx'), lotteryAudio.sfxOn, lotteryAudio.sfxVol, 'Sound effects');
}

function wireAudio() {
  lotteryAudio.init();
  lotteryAudio.onChange = renderAudioControls;
  state.machine.onEvent((type, detail) => {
    const handler = MACHINE_SOUNDS[type];
    if (handler) handler(detail);
  });
  $('toggle-music').addEventListener('click', () => lotteryAudio.toggleMusic());
  $('toggle-sfx').addEventListener('click', () => lotteryAudio.toggleSfx());
  $('vol-music').addEventListener('input', (event) =>
    lotteryAudio.setMusicVolume(Number(event.target.value) / 100));
  $('vol-sfx').addEventListener('input', (event) =>
    lotteryAudio.setSfxVolume(Number(event.target.value) / 100));
  renderAudioControls();
}

function syncMachine(data, settledTransition) {
  const machine = state.machine;
  const previous = data.previous_result;

  if (!data.sales_open) {
    $('replay-button').classList.add('hidden');
    const live = data.live_mains || [];
    const hasLive = live.length > 0 || (data.live_bonus ?? null) !== null;
    setAudioPhase(hasLive ? 'drawing' : 'waiting');
    if (hasLive) {
      if (state.machineDraw !== data.draw_id) {
        machine.reset();
        state.machineDraw = data.draw_id;
      }
      setOverlay(false);
      machine.reveal(live, data.live_bonus);
    } else {
      if (state.machineDraw !== data.draw_id) {
        clearInterval(state.machineResetTimer);
        machine.reset();
        machine.load();
        state.machineDraw = data.draw_id;
      }
      setOverlay(true, data.live_location
        ? rollingCard(data.live_location)
        : 'The draw is starting soon - good luck!');
    }
    return;
  }

  setAudioPhase('idle');
  if (!previous) return;
  if (state.machineDraw !== previous.draw_id) {
    // Page opened mid-selling: idle machine, balls staged in the feed pipes.
    clearInterval(state.machineResetTimer);
    machine.reset();
    state.machineDraw = previous.draw_id;
  } else if (settledTransition) {
    machine.reveal(previous.main_numbers, previous.bonus_number);
    scheduleMachineReset();
  }
  setOverlay(false);
  $('replay-button').classList.toggle('hidden', reducedMotion);
}

const RESULT_LINGER_MS = 12_000;

function scheduleMachineReset() {
  clearInterval(state.machineResetTimer);
  let doneAt = null;
  state.machineResetTimer = setInterval(() => {
    if (state.machine.isPlaying()) {
      doneAt = null;
      return;
    }
    if (doneAt === null) {
      doneAt = Date.now();
      return;
    }
    if (Date.now() - doneAt >= RESULT_LINGER_MS) {
      clearInterval(state.machineResetTimer);
      state.machine.reset();
    }
  }, 500);
}


function renderPickers() {
  const mains = $('main-picker');
  mains.replaceChildren();
  for (let number = 1; number <= 15; number += 1) {
    const button = el('button', `pick-ball${state.pickedMains.has(number) ? ' is-picked' : ''}`, String(number));
    button.type = 'button';
    button.addEventListener('click', () => toggleMain(number));
    mains.appendChild(button);
  }
  const bonus = $('bonus-picker');
  bonus.replaceChildren();
  for (let number = 1; number <= 5; number += 1) {
    const button = el('button', `pick-ball${state.pickedBonus === number ? ' is-picked' : ''}`, String(number));
    button.type = 'button';
    button.addEventListener('click', () => {
      state.pickedBonus = state.pickedBonus === number ? null : number;
      lotteryAudio.click();
      renderPickers();
    });
    bonus.appendChild(button);
  }
  $('add-line').disabled = !(state.pickedMains.size === MAIN_COUNT && state.pickedBonus !== null);
}

function toggleMain(number) {
  if (state.pickedMains.has(number)) state.pickedMains.delete(number);
  else if (state.pickedMains.size < MAIN_COUNT) state.pickedMains.add(number);
  lotteryAudio.click();
  renderPickers();
}

function pickForMe() {
  const pool = Array.from({ length: 15 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  state.pickedMains = new Set(pool.slice(0, MAIN_COUNT));
  state.pickedBonus = 1 + Math.floor(Math.random() * 5);
  lotteryAudio.shuffle();
  renderPickers();
}

function addLine() {
  if (state.pickedMains.size !== MAIN_COUNT || state.pickedBonus === null) return;
  state.basket.push({
    main_numbers: [...state.pickedMains].sort((a, b) => a - b),
    bonus_number: state.pickedBonus
  });
  state.pickedMains = new Set();
  state.pickedBonus = null;
  renderPickers();
  renderBasket();
}

function renderBasket() {
  const wrap = $('basket-wrap');
  const list = $('basket');
  list.replaceChildren();
  wrap.classList.toggle('hidden', state.basket.length === 0);
  state.basket.forEach((line, index) => {
    const item = el('li');
    item.appendChild(ballRow(line.main_numbers, line.bonus_number));
    const remove = el('button', 'basket-remove', '✕');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove ticket');
    remove.addEventListener('click', () => {
      state.basket.splice(index, 1);
      renderBasket();
    });
    item.appendChild(remove);
    list.appendChild(item);
  });
  const total = state.basket.length * (state.current?.ticket_price ?? 0);
  $('basket-total-label').textContent = `Total: ${gil(total)} (${state.basket.length} ticket${state.basket.length === 1 ? '' : 's'})`;
}

function setBuyStatus(message, kind = '') {
  const node = $('buy-status');
  node.textContent = message;
  node.className = `buy-status${kind ? ` is-${kind}` : ''}`;
}

function showPurchaseToast(tickets) {
  const existing = document.querySelector('.lotto-toast');
  if (existing) existing.remove();
  const toast = el('div', 'lotto-toast');
  const head = el('div', 'lotto-toast__head');
  head.appendChild(el('span', 'lotto-toast__title',
    `🎟️ ${tickets.length} ticket${tickets.length === 1 ? '' : 's'} bought - good luck!`));
  const dismiss = el('button', 'modal__close', '✕');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.addEventListener('click', () => toast.remove());
  head.appendChild(dismiss);
  toast.appendChild(head);
  const lines = el('div', 'lotto-toast__lines');
  for (const ticket of tickets.slice(0, 6)) {
    lines.appendChild(ballRow(ticket.main_numbers, ticket.bonus_number));
  }
  if (tickets.length > 6) {
    lines.appendChild(el('p', 'lotto-toast__more', `…and ${tickets.length - 6} more in My Tickets`));
  }
  toast.appendChild(lines);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

async function buyBasket() {
  if (state.basket.length === 0) return;
  const button = $('buy-button');
  button.disabled = true;
  setBuyStatus('Buying tickets…');
  const result = await lotteryClient.buyTickets(state.basket);
  button.disabled = false;
  if (!result.ok) {
    if (result.status === 401) {
      setSignedIn(false);
      setBuyStatus('Please sign in again.', 'error');
      return;
    }
    setBuyStatus(result.error, 'error');
    return;
  }
  const count = result.data.tickets.length;
  setBuyStatus('');
  lotteryAudio.purchase();
  showPurchaseToast(result.data.tickets);
  state.basket = [];
  renderBasket();
  state.current.pot = result.data.pot;
  state.current.ticket_count += count;
  renderHeader();
  renderPrizes();
  loadMyTickets();
}

function renderBuyPanel() {
  const open = state.current?.sales_open ?? false;
  $('buy-closed').classList.toggle('hidden', open);
  $('buy-signin').classList.toggle('hidden', state.signedIn);
  $('buy-form').classList.toggle('hidden', !open || !state.signedIn);
  $('buy-hint').textContent = open && state.current
    ? `${gil(state.current.ticket_price)} per ticket`
    : 'Sales closed';
}

function setSignedIn(signedIn) {
  if (state.signedIn === signedIn) return;
  state.signedIn = signedIn;
  renderBuyPanel();
  $('my-tickets-panel').classList.toggle('hidden', !signedIn);
  if (signedIn) loadMyTickets();
}


function ticketItem(ticket, drawn) {
  const item = el('li');
  if ((ticket.prize_amount ?? 0) > 0) item.classList.add('is-winner');
  item.appendChild(ballRow(ticket.main_numbers, ticket.bonus_number, drawn));
  const result = el('span', 'ticket-result');
  if (ticket.prize_tier === null) {
    if (drawn) {
      const hits = ticket.main_numbers.filter((n) => drawn.mains.includes(n)).length
        + (drawn.bonus === ticket.bonus_number ? 1 : 0);
      result.textContent = hits > 0 ? `${hits} ball${hits === 1 ? '' : 's'} hit!` : 'No hits yet';
      if (hits > 0) result.classList.add('is-hitting');
    } else {
      result.textContent = `Draw #${ticket.draw_id}`;
    }
  } else if ((ticket.prize_amount ?? 0) > 0) {
    const labels = { 0: 'JACKPOT!', 1: 'Match 4', 2: 'Match 3 + Bonus', 3: 'Match 3', 4: 'Match 2 + Bonus' };
    result.appendChild(el('span', '', labels[ticket.prize_tier] || 'Winner'));
    result.appendChild(el('span', 'win-amount', gil(ticket.prize_amount)));
  } else {
    result.textContent = 'No win';
  }
  item.appendChild(result);
  return item;
}

// Matched-number highlights follow the machine animation, not the raw live
// payload: a ball only counts as drawn once it has parked on the tray.
function currentDrawnInfo() {
  const data = state.current;
  if (!data || data.sales_open) return null;
  const revealed = state.machine.revealedNumbers();
  if (revealed.mains.length === 0 && revealed.bonus === null) return null;
  return revealed;
}

function renderMyCurrent() {
  const currentList = $('my-current');
  currentList.replaceChildren();
  if (state.myCurrent.length === 0) {
    currentList.appendChild(el('li', 'ticket-empty', 'No tickets for this draw yet.'));
    return;
  }
  const drawn = currentDrawnInfo();
  for (const ticket of state.myCurrent) currentList.appendChild(ticketItem(ticket, drawn));
}

async function loadMyTickets() {
  const result = await lotteryClient.getMyTickets();
  if (!result.ok) {
    if (result.status === 401) setSignedIn(false);
    return;
  }
  state.myCurrent = result.data.current;
  renderMyCurrent();
  $('my-tickets-hint').textContent = `${result.data.current.length} in this draw`;
  state.myTicketsByDraw = new Map();
  for (const ticket of result.data.past) {
    const bucket = state.myTicketsByDraw.get(ticket.draw_id) || [];
    bucket.push(ticket);
    state.myTicketsByDraw.set(ticket.draw_id, bucket);
  }
}


function statCell(row, maxCount, { bonus = false, overdueThreshold = null } = {}) {
  const cell = el('div', `stat-cell${bonus ? ' stat-cell--bonus' : ''}`);
  const overdue = overdueThreshold !== null && row.draws_since_seen >= overdueThreshold && row.times_drawn > 0;
  if (overdue) cell.classList.add('stat-cell--overdue');
  cell.appendChild(ballChip(row.number, { bonus }));
  const bar = el('div', 'stat-cell__bar');
  const fill = el('div', 'stat-cell__fill');
  fill.style.width = maxCount > 0 ? `${Math.round((row.times_drawn / maxCount) * 100)}%` : '0%';
  bar.appendChild(fill);
  cell.appendChild(bar);
  cell.appendChild(el('span', 'stat-cell__count', `${row.times_drawn}×`));
  cell.title = bonus
    ? `Drawn ${row.times_drawn} time(s)`
    : `Drawn ${row.times_drawn} time(s) · ${row.draws_since_seen} draw(s) since last seen`;
  return cell;
}

function renderStats(stats) {
  $('stats-hint').textContent = `${stats.total_draws} draw${stats.total_draws === 1 ? '' : 's'} so far`;
  const empty = stats.total_draws === 0;
  $('stats-empty').classList.toggle('hidden', !empty);
  const highlights = $('stats-highlights');
  highlights.replaceChildren();
  if (!empty) {
    const sorted = [...stats.main_numbers].sort((a, b) => b.times_drawn - a.times_drawn);
    const hot = sorted[0];
    const cold = sorted[sorted.length - 1];
    const overdue = [...stats.main_numbers].sort((a, b) => b.draws_since_seen - a.draws_since_seen)[0];
    const chip = (label, row, bonus = false) => {
      const node = el('span', 'stat-chip');
      node.appendChild(el('span', '', label));
      node.appendChild(ballChip(row.number, { bonus }));
      return node;
    };
    highlights.appendChild(chip('🔥 Hot', hot));
    highlights.appendChild(chip('🧊 Cold', cold));
    highlights.appendChild(chip('⏳ Overdue', overdue));
  }
  const maxMain = Math.max(1, ...stats.main_numbers.map((row) => row.times_drawn));
  const maxBonus = Math.max(1, ...stats.bonus_numbers.map((row) => row.times_drawn));
  const mains = $('stats-mains');
  mains.replaceChildren();
  for (const row of stats.main_numbers) {
    mains.appendChild(statCell(row, maxMain, { overdueThreshold: Math.max(4, stats.total_draws / 3) }));
  }
  const bonus = $('stats-bonus');
  bonus.replaceChildren();
  for (const row of stats.bonus_numbers) bonus.appendChild(statCell(row, maxBonus, { bonus: true }));
}


function winnersTable(winners) {
  const wrap = el('div', 'table-wrap table-wrap--flush');
  const table = el('table', 'prize-table winners-table');
  const head = el('thead');
  const headRow = el('tr');
  for (const label of ['Player', 'Match', 'Prize']) headRow.appendChild(el('th', '', label));
  head.appendChild(headRow);
  table.appendChild(head);
  const tbody = el('tbody');
  for (const winner of winners) {
    const row = el('tr');
    const who = el('td');
    who.appendChild(el('span', 'winner-name', winner.player_name));
    who.appendChild(el('span', 'winner-world', winner.player_world));
    row.appendChild(who);
    row.appendChild(el('td', winner.prize_tier === 0 ? 'prize-jackpot' : '', winner.tier_label));
    row.appendChild(el('td', `prize-amount${winner.prize_tier === 0 ? ' prize-jackpot' : ''}`, gil(winner.prize_amount)));
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function renderWinnersInto(container, drawId) {
  const holder = el('div');
  container.appendChild(holder);
  const render = (winners) => {
    holder.replaceChildren();
    if (winners.length === 0) return;
    holder.appendChild(el('p', 'picker-caption', `Winners (${winners.length})`));
    holder.appendChild(winnersTable(winners));
  };
  const cached = state.winnersByDraw.get(drawId);
  if (cached) {
    render(cached);
    return;
  }
  holder.appendChild(el('p', 'history-detail history-detail--muted', 'Loading winners…'));
  lotteryClient.getWinners(drawId).then((result) => {
    if (!result.ok) {
      holder.replaceChildren(el('p', 'history-detail history-detail--muted', 'Could not load the winners.'));
      return;
    }
    state.winnersByDraw.set(drawId, result.data.winners);
    render(result.data.winners);
  });
}

function poolLine(result) {
  const pool = gil(result.pool_before ?? 0);
  const fixed = Number(result.fixed_prizes_paid || 0);
  if (result.jackpot_winner_count > 0) {
    return fixed > 0
      ? `From a jackpot pool of ${pool}, with ${gil(fixed)} paid out in fixed prizes first.`
      : `From a jackpot pool of ${pool}, with no fixed prizes to pay out first.`;
  }
  return fixed > 0
    ? `Jackpot pool of ${pool}, less ${gil(fixed)} in fixed prizes. The rest rolls over to next week.`
    : `Jackpot pool of ${pool} rolls over to next week.`;
}

function historyDetails(draw) {
  const body = el('div', 'history-item__body');
  const drawn = { mains: draw.main_numbers, bonus: draw.bonus_number };

  const totalWinners = Object.values(draw.winners_by_tier).reduce((sum, count) => sum + count, 0);
  if (draw.jackpot_winner_count > 0) {
    body.appendChild(el('p', 'history-detail is-jackpot', `💰 Jackpot won - ${gil(draw.jackpot_paid)} paid out!`));
  }
  body.appendChild(el('p', 'history-detail history-detail--muted', poolLine(draw)));
  if (totalWinners === 0) {
    body.appendChild(el('p', 'history-detail', 'No winning tickets this draw.'));
  } else {
    renderWinnersInto(body, draw.draw_id);
  }

  const mine = state.myTicketsByDraw.get(draw.draw_id) || [];
  if (!state.signedIn) {
    body.appendChild(el('p', 'history-detail history-detail--muted', 'Sign in to see your tickets for this draw.'));
  } else if (mine.length === 0) {
    body.appendChild(el('p', 'history-detail history-detail--muted', 'You had no tickets in this draw.'));
  } else {
    body.appendChild(el('p', 'picker-caption', `Your tickets (${mine.length})`));
    const mineList = el('ul', 'ticket-list');
    for (const ticket of mine) mineList.appendChild(ticketItem(ticket, drawn));
    body.appendChild(mineList);
  }
  return body;
}

function renderHistory(draws, append) {
  const list = $('history-list');
  if (!append) list.replaceChildren();
  if (draws.length === 0 && !append) {
    list.appendChild(el('li', 'history-empty', 'No draws yet - be part of the very first one!'));
    return;
  }
  for (const draw of draws) {
    const item = el('li', 'history-item');
    const head = el('button', 'history-item__head');
    head.type = 'button';
    head.setAttribute('aria-expanded', 'false');
    const date = parseUtc(draw.drawn_at || draw.scheduled_at);
    head.appendChild(el('span', 'history-date', date.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    })));
    head.appendChild(ballRow(draw.main_numbers, draw.bonus_number));
    const meta = el('span', 'history-meta');
    const mine = state.myTicketsByDraw.get(draw.draw_id) || [];
    if (draw.jackpot_winner_count > 0) meta.appendChild(el('span', 'is-jackpot', '💰 '));
    meta.appendChild(el('span', '', mine.length > 0 ? `${mine.length} of your tickets` : `${draw.ticket_count} tickets`));
    head.appendChild(meta);
    head.appendChild(el('span', 'history-chevron', '▾'));
    item.appendChild(head);

    let body = null;
    head.addEventListener('click', () => {
      const expanded = item.classList.toggle('is-open');
      head.setAttribute('aria-expanded', String(expanded));
      if (expanded && body === null) {
        body = historyDetails(draw);
        item.appendChild(body);
      }
    });
    list.appendChild(item);
  }
}

async function loadHistory(append = false) {
  const result = await lotteryClient.getHistory(state.historyPage);
  if (!result.ok) return;
  renderHistory(result.data.draws, append);
  $('history-more').classList.toggle('hidden', !result.data.has_more);
}


function openModal(id) {
  $(id).classList.remove('hidden');
  document.addEventListener('keydown', onModalKeydown);
}

function closeModals() {
  $('howto-modal').classList.add('hidden');
  $('history-modal').classList.add('hidden');
  document.removeEventListener('keydown', onModalKeydown);
}

function onModalKeydown(event) {
  if (event.key === 'Escape') closeModals();
}


const WINNER_POPUP_MINUTES = 15;

function dismissWinnerOverlay() {
  state.winnerPopupDismissed = state.winnerPopupFor;
  $('winner-overlay').classList.add('hidden');
}

function maybeShowWinnerPopup() {
  const previous = state.current?.previous_result;
  if (!previous || !state.current.sales_open) return;
  const drawnAt = parseUtc(previous.drawn_at || previous.scheduled_at);
  const expiresAtMs = drawnAt.getTime() + WINNER_POPUP_MINUTES * 60_000;
  if (Date.now() >= expiresAtMs) return;
  if (state.winnerPopupFor === previous.draw_id || state.winnerPopupDismissed === previous.draw_id) return;
  state.winnerPopupFor = previous.draw_id;
  clearInterval(state.winnerPopupWaiter);
  state.winnerPopupWaiter = setInterval(() => {
    if (state.machine.isPlaying()) return;
    clearInterval(state.winnerPopupWaiter);
    showWinnerPopup(previous, expiresAtMs);
  }, 500);
}

async function showWinnerPopup(result, expiresAtMs) {
  const balls = $('winner-balls');
  balls.replaceChildren();
  for (const number of result.main_numbers) balls.appendChild(ballChip(number));
  balls.appendChild(el('span', 'ball-plus', '+'));
  balls.appendChild(ballChip(result.bonus_number, { bonus: true }));

  const content = $('winner-content');
  content.replaceChildren(el('p', 'history-detail history-detail--muted', 'Loading the winners…'));
  $('winner-overlay').classList.remove('hidden');
  playResultSting(result);
  clearTimeout(state.winnerPopupTimer);
  state.winnerPopupTimer = setTimeout(() => {
    $('winner-overlay').classList.add('hidden');
  }, Math.max(1000, expiresAtMs - Date.now()));

  const response = await lotteryClient.getWinners(result.draw_id);
  if (state.winnerPopupFor !== result.draw_id) return;
  content.replaceChildren();
  if (result.jackpot_winner_count > 0) {
    content.appendChild(el('p', 'winner-banner winner-banner--won',
      `💰 JACKPOT WON - ${gil(result.jackpot_paid)} paid out!`));
  } else {
    content.appendChild(el('p', 'winner-banner',
      'Nobody hit the jackpot - it rolls over and keeps growing!'));
  }
  content.appendChild(el('p', 'winner-banner winner-banner--pool', poolLine(result)));
  if (state.current?.sales_open) {
    const nextAt = parseUtc(state.current.scheduled_at).toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    content.appendChild(el('p', 'winner-banner winner-banner--next',
      `🎟️ Ticket sales are now open - next draw ${nextAt}!`));
  }
  if (!response.ok) {
    content.appendChild(el('p', 'history-detail history-detail--muted', 'Could not load the winners.'));
    return;
  }
  const winners = response.data.winners;
  state.winnersByDraw.set(result.draw_id, winners);
  if (winners.length === 0) {
    content.appendChild(el('p', 'history-detail', 'No winning tickets this week - better luck next draw!'));
    return;
  }
  const drawn = { mains: result.main_numbers, bonus: result.bonus_number };
  const list = el('ul', 'winner-list');
  for (const winner of winners) {
    const item = el('li', winner.prize_tier === 0 ? 'is-jackpot-row' : '');
    const who = el('div', 'winner-list__who');
    who.appendChild(el('span', 'winner-name', winner.player_name));
    who.appendChild(el('span', 'winner-world', winner.player_world));
    item.appendChild(who);
    item.appendChild(ballRow(winner.main_numbers, winner.bonus_number, drawn));
    const prize = el('div', 'winner-list__prize');
    prize.appendChild(el('span', 'winner-list__tier', winner.tier_label));
    prize.appendChild(el('span', 'win-amount', gil(winner.prize_amount)));
    item.appendChild(prize);
    list.appendChild(item);
  }
  content.appendChild(list);
}


async function refreshCurrent() {
  const result = await lotteryClient.getCurrent();
  if (!result.ok) return;
  const isFirstLoad = state.current === null;
  const hadResultId = state.current?.previous_result?.draw_id ?? null;
  state.current = result.data;
  renderHeader();
  renderPrizes();
  renderBuyPanel();
  const newResultId = result.data.previous_result?.draw_id ?? null;
  const settledTransition = !isFirstLoad && newResultId !== null && newResultId !== hadResultId;
  syncMachine(result.data, settledTransition);
  if (state.signedIn) renderMyCurrent();
  if (settledTransition) {
    state.historyPage = 1;
    state.winnersByDraw.delete(newResultId);
    loadHistory();
    lotteryClient.getStats().then((stats) => stats.ok && renderStats(stats.data));
    if (state.signedIn) loadMyTickets();
  }
  maybeShowWinnerPopup();
  schedulePoll();
}

function schedulePoll() {
  clearTimeout(state.pollTimer);
  if (!state.current) {
    state.pollTimer = setTimeout(refreshCurrent, POLL_HOT_MS);
    return;
  }
  const closeAt = parseUtc(state.current.sales_close_at);
  const delay = !state.current.sales_open
    ? POLL_LIVE_MS
    : closeAt - Date.now() < 10 * 60_000
      ? POLL_HOT_MS
      : POLL_IDLE_MS;
  state.pollTimer = setTimeout(refreshCurrent, delay);
}

function connectLotterySocket() {
  const url = `${apiBaseUrl.replace(/^http/, 'ws')}/lottery/ws`;
  let attempts = 0;
  const open = () => {
    const socket = new WebSocket(url);
    socket.onopen = () => {
      attempts = 0;
      refreshCurrent();
    };
    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.event === 'update') refreshCurrent();
    };
    socket.onclose = () => {
      attempts += 1;
      setTimeout(open, Math.min(30_000, 1000 * 2 ** attempts));
    };
  };
  open();
}


async function boot() {
  state.machine = createDrawMachine($('draw-canvas'));
  state.machine.onReveal((ball) => {
    if (state.signedIn) renderMyCurrent();
    playHitSound(ball);
  });
  wireAudio();
  wireInfotips();
  renderPickers();
  renderBasket();

  $('lucky-dip').addEventListener('click', pickForMe);
  $('add-line').addEventListener('click', addLine);
  $('buy-button').addEventListener('click', buyBasket);
  $('history-more').addEventListener('click', () => {
    state.historyPage += 1;
    loadHistory(true);
  });
  $('open-howto').addEventListener('click', () => openModal('howto-modal'));
  $('howto-close').addEventListener('click', closeModals);
  const openHistory = () => {
    state.historyPage = 1;
    loadHistory();
    openModal('history-modal');
  };
  $('open-history').addEventListener('click', openHistory);
  $('open-history-inline').addEventListener('click', openHistory);
  $('history-close').addEventListener('click', closeModals);
  $('winner-close').addEventListener('click', dismissWinnerOverlay);
  for (const id of ['howto-modal', 'history-modal']) {
    $(id).addEventListener('click', (event) => {
      if (event.target === $(id)) closeModals();
    });
  }
  $('replay-button').addEventListener('click', () => {
    const previous = state.current?.previous_result;
    if (previous && !state.machine.isPlaying()) {
      state.machine.play(previous.main_numbers, previous.bonus_number, { instant: reducedMotion });
      state.machineDraw = previous.draw_id;
      scheduleMachineReset();
    }
  });
  $('signin-button').addEventListener('click', () =>
    openLoginModal({
      intro: 'Sign in with your OOF account token to buy lottery tickets.',
      onSuccess: () => setSignedIn(true)
    })
  );
  window.addEventListener('oof-wallet-changed', (event) => setSignedIn(Boolean(event.detail)));

  await refreshCurrent();
  openModal('howto-modal');
  connectLotterySocket();
  setInterval(tickCountdown, 1000);
  tickCountdown();
  const stats = await lotteryClient.getStats();
  if (stats.ok) renderStats(stats.data);
  if (hasRecentSession()) {
    const wallet = await walletClient.getWallet();
    setSignedIn(wallet.ok);
  }
}

boot();
