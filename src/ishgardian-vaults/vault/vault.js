import { getPlayState, reveal, spin, uuid } from '../../api/ishgardian-vaults-client.js';
import { createReel, colourFor, NO_WIN_OUTCOME, BONUS_OUTCOME } from './reel.js';
import audio from './vault-audio.js';
import gold from './vault-gold.js';

const VAULT_PREFIX = '/ishgardian-vaults/vault/';
const CHEST_SRC = (tier) => `/game-assets/ishgardian-vaults/chests/tier${tier}.webp`;
const CHEST_OPEN_SRC = (tier) => `/game-assets/ishgardian-vaults/chests/tier${tier}-open.webp`;
const BONUS_SRC = '/game-assets/ishgardian-vaults/chests/bonus.webp';
const IMAGE_TIMEOUT_MS = 8000;
const OPEN_DELAY_MS = 1600;
const SETTLE_TOTAL_MS = 4600;
const STOP_STAGGER_MS = 1000;
const SHAKE_MS = [700, 850, 1050, 1400, 2000];
const REVEAL_MS = 780;
const REVEAL_REDUCED_MS = 300;
const SLOTS = 5;
const MAX_RUN = 2;
const PANEL_MIN_SCALE = 0.75;
const PANEL_NEAR_MISS = 1.06;
const FAIRNESS_ROWS = 5;

const LOCK_ICON =
  '<svg class="vault-reel__lock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M7.4 10.4V7.6a4.6 4.6 0 0 1 9.2 0v2.8" fill="none" stroke="currentColor" ' +
  'stroke-width="2.1" stroke-linecap="round" />' +
  '<rect x="4.6" y="10.2" width="14.8" height="10.4" rx="2.4" fill="currentColor" />' +
  '<circle cx="12" cy="14.4" r="1.5" fill="#0b1017" />' +
  '<rect x="11.2" y="15.2" width="1.6" height="3.2" rx="0.8" fill="#0b1017" />' +
  '</svg>';

function getToken() {
  const path = window.location.pathname;
  if (path.startsWith(VAULT_PREFIX)) {
    const rest = path.slice(VAULT_PREFIX.length).replace(/\/+$/, '');
    if (rest) return decodeURIComponent(rest);
  }
  return new URLSearchParams(window.location.search).get('s');
}

const dom = {
  loader: document.getElementById('vault-loader'),
  loaderText: document.getElementById('vault-loader-text'),
  main: document.getElementById('vault-main'),
  closed: document.getElementById('vault-closed'),
  closedTitle: document.getElementById('vault-closed-title'),
  closedText: document.getElementById('vault-closed-text'),
  venue: document.getElementById('vault-venue'),
  spins: document.getElementById('vault-spins'),
  spinsTotal: document.getElementById('vault-spins-total'),
  spinsBar: document.getElementById('vault-spins-bar'),
  nav: document.getElementById('vault-nav'),
  actions: document.getElementById('vault-actions'),
  reels: document.getElementById('vault-reels'),
  guide: document.getElementById('vault-guide'),
  guideTitle: document.getElementById('vault-guide-title'),
  guideNote: document.getElementById('vault-guide-note'),
  stage: document.querySelector('.vault-stage'),
  guidePanel: document.querySelector('.vault-guide'),
  historyPanel: document.querySelector('.vault-history'),
  count: document.getElementById('vault-count'),
  countGroup: document.getElementById('vault-count-group'),
  countUp: document.getElementById('vault-count-up'),
  countDown: document.getElementById('vault-count-down'),
  spinButton: document.getElementById('vault-spin'),
  spinLabel: document.getElementById('vault-spin-label'),
  status: document.getElementById('vault-status'),
  history: document.getElementById('vault-history'),
  historyCount: document.getElementById('vault-history-count'),
  historyEmpty: document.getElementById('vault-history-empty'),
  fairness: document.getElementById('vault-fairness'),
  fairFoot: document.getElementById('fair-foot'),
  back: document.getElementById('vault-back'),
  howto: document.getElementById('howto-modal'),
  howtoOpen: document.getElementById('open-howto'),
  howtoClose: document.getElementById('howto-close'),
  howtoSteps: document.getElementById('howto-steps'),
  fair: document.getElementById('fair-modal'),
  fairOpen: document.getElementById('open-fair'),
  fairClose: document.getElementById('fair-close'),
  open: document.getElementById('open-modal'),
  openGrid: document.getElementById('open-grid'),
  openAll: document.getElementById('open-all'),
  openNote: document.getElementById('open-note'),
  openClose: document.getElementById('open-close'),
};

const state = {
  token: getToken(),
  session: null,
  count: 1,
  countBeforeBonus: 1,
  spinning: false,
  batch: 0,
  slots: [],
  images: new Map(),
  art: [],
  results: [],
  revealed: new Set(),
  bonus: false,
  transition: '',
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const actionsHome = dom.actions ? dom.actions.parentElement : null;

const fairness = [];

function placeActions() {
  if (!dom.actions || !actionsHome || !dom.nav) return;
  const stacked = getComputedStyle(dom.nav).getPropertyValue('--stacked').trim() === '1';
  const target = stacked ? dom.nav : actionsHome;
  if (dom.actions.parentElement !== target) target.appendChild(dom.actions);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setStatus(message, isError) {
  dom.status.textContent = message || '';
  dom.status.classList.toggle('is-error', Boolean(isError));
  if (message && isError) audio.error();
}

function showClosed(title, text) {
  dom.loader.hidden = true;
  dom.main.hidden = true;
  dom.closed.hidden = false;
  if (title) dom.closedTitle.textContent = title;
  if (text) dom.closedText.textContent = text;
}

function imageUrl(ref) {
  if (!ref) return '';
  if (ref.startsWith('catalogue:')) {
    return `/game-assets/ishgardian-vaults/catalogue/${encodeURIComponent(ref.slice('catalogue:'.length))}.png`;
  }
  return ref;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), IMAGE_TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timer);
      if (typeof image.decode === 'function') {
        image.decode().then(() => finish(image)).catch(() => finish(image));
      } else {
        finish(image);
      }
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    image.src = src;
  });
}

function cofferUrl(outcome) {
  const view = state.session.tiers.find((tier) => tier.tier === outcome);
  const own = view && view.imageRef ? imageUrl(view.imageRef) : '';
  return own || defaultUrl(outcome);
}

function defaultUrl(outcome) {
  if (outcome >= 1 && outcome <= 5) return CHEST_SRC(outcome);
  if (outcome === BONUS_OUTCOME) return BONUS_SRC;
  return '';
}

function openChestUrl(outcome) {
  if (outcome < 1 || outcome > 5) return '';
  return onSiteDefault(outcome) ? CHEST_OPEN_SRC(outcome) : '';
}

function onSiteDefault(outcome) {
  const view = state.session.tiers.find((tier) => tier.tier === outcome);
  return !(view && view.imageRef);
}

function buildArt() {
  const art = [];
  for (let outcome = 0; outcome <= BONUS_OUTCOME; outcome += 1) {
    const url = cofferUrl(outcome);
    const image = url ? state.images.get(url) : null;
    const fallback = state.images.get(defaultUrl(outcome)) || null;
    art[outcome] = image || fallback;
  }
  return art;
}

async function preload(session) {
  const sources = session.preloadImages.map(imageUrl).filter(Boolean);
  for (let tier = 1; tier <= 5; tier += 1) {
    sources.push(CHEST_SRC(tier));
    if (onSiteDefault(tier)) sources.push(CHEST_OPEN_SRC(tier));
  }
  sources.push(BONUS_SRC);

  const unique = [...new Set(sources)];

  let done = 0;
  const total = unique.length;
  const update = () => {
    done += 1;
    dom.loaderText.textContent = `Opening the vault · ${done}/${total}`;
  };

  const loaded = await Promise.all(
    unique.map((src) => loadImage(src).then((image) => {
      update();
      return [src, image];
    }))
  );
  state.images = new Map(loaded);
  state.art = buildArt();
}

function fitPanel(panel, target) {
  if (!panel) return;
  panel.style.removeProperty('height');
  panel.style.setProperty('--panel-scale', '1');
  if (!target) return;

  let scale = 1;
  for (let pass = 0; pass < 5 && scale > PANEL_MIN_SCALE; pass += 1) {
    const height = panel.offsetHeight;
    if (height <= target) break;
    scale = Math.max(PANEL_MIN_SCALE, scale * (target / height));
    panel.style.setProperty('--panel-scale', String(scale));
  }

  const over = panel.offsetHeight;
  if (over > target && over <= target * PANEL_NEAR_MISS) {
    panel.style.setProperty('--panel-scale', String(scale * (target / over)));
  }

  if (panel.offsetHeight <= target) panel.style.height = `${target}px`;
}

function fitPanels() {
  if (!dom.stage || dom.main.hidden) return;
  const wide = window.matchMedia('(min-width: 1024px)').matches;
  const target = wide ? dom.stage.getBoundingClientRect().height : 0;
  fitPanel(dom.guidePanel, target);
  fitPanel(dom.historyPanel, target);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function tierLabel(tier) {
  const found = state.session.tiers.find((entry) => entry.tier === tier);
  return found ? found.label : `Tier ${tier}`;
}

function renderGuide() {
  const bonus = state.bonus;
  const tiers = bonus ? state.session.bonusTiers || [] : state.session.tiers;

  const flaggedLeft = state.session.prizes.some((prize) => prize.inBonus && prize.inStock);

  dom.guideTitle.textContent = bonus
    ? state.session.bonusLabel || 'Bonus Game'
    : 'Win Guide';
  dom.guideNote.hidden = bonus;

  dom.guide.replaceChildren();
  tiers.slice().reverse().forEach((tier) => {
    const column = document.createElement('div');
    column.className = 'vault-tier';
    if (tier.tier === BONUS_OUTCOME) column.classList.add('vault-tier--bonus');
    column.style.setProperty('--tier-colour', tier.colour || colourFor(tier.tier));

    const head = document.createElement('div');
    head.className = 'vault-tier__head';
    head.innerHTML =
      `<span class="vault-tier__name">${escapeHtml(tier.label)}</span>` +
      `<span class="vault-tier__odds">${tier.percent}%</span>`;
    column.appendChild(head);

    const meter = document.createElement('div');
    meter.className = 'vault-tier__meter';
    const fill = document.createElement('span');
    fill.style.width = `${Math.max(1, Math.min(100, Number(tier.percent) || 0))}%`;
    meter.appendChild(fill);
    column.appendChild(meter);

    const list = document.createElement('ul');
    list.className = 'vault-tier__prizes';
    state.session.prizes
      .filter((prize) => prize.tier === tier.tier && (!bonus || !flaggedLeft || prize.inBonus))
      .forEach((prize) => {
        const item = document.createElement('li');
        item.className = 'vault-prize';
        if (prize.unlimited) item.classList.add('vault-prize--unlimited');
        else if (!prize.inStock) item.classList.add('is-out');
        if (prize.inBonus) item.classList.add('is-in-bonus');

        const url = imageUrl(prize.imageRef);
        const thumb = url
          ? `<img class="vault-prize__image" src="${escapeHtml(url)}" alt="" loading="eager" />`
          : '<span class="vault-prize__image vault-prize__image--empty" aria-hidden="true"></span>';

        const stock = prize.unlimited
          ? ''
          : `<span class="vault-prize__stock">${prize.inStock ? `x${prize.stockRemaining}` : 'Gone'}</span>`;

        item.innerHTML =
          thumb +
          `<span class="vault-prize__name">${escapeHtml(prize.name)}</span>` +
          stock;
        list.appendChild(item);
      });

    if (!list.children.length) {
      const empty = document.createElement('li');
      empty.className = 'vault-prize vault-prize--none';
      empty.textContent = 'Nothing in this tier';
      list.appendChild(empty);
    }

    column.appendChild(list);
    dom.guide.appendChild(column);
  });

  fitPanels();
}

function renderHistory(all) {
  const results = all.filter(
    (result) => state.revealed.has(result.spinId) && !result.isNoWin && !result.isBonus
  );
  dom.historyCount.textContent = String(results.length);
  dom.historyEmpty.hidden = results.length > 0;
  dom.history.replaceChildren();

  const groups = new Map();
  results.forEach((result, order) => {
    const key = result.prize.prizeId ?? `${result.tier}|${result.prize.name}`;
    const found = groups.get(key);
    if (found) {
      found.count += 1;
      found.order = order;
      return;
    }
    groups.set(key, { tier: result.tier, prize: result.prize, count: 1, order });
  });

  [...groups.values()].sort((a, b) => b.order - a.order).forEach((group) => {
    const item = document.createElement('li');
    item.className = 'vault-win';
    item.style.setProperty('--tier-colour', colourFor(group.tier));
    const url = imageUrl(group.prize.imageRef);
    item.innerHTML =
      (url ? `<img class="vault-win__image" src="${escapeHtml(url)}" alt="" />` : '') +
      '<span class="vault-win__body">' +
      `<span class="vault-win__tier">${escapeHtml(tierLabel(group.tier))}</span>` +
      `<span class="vault-win__name">${escapeHtml(group.prize.name)}</span>` +
      '</span>' +
      (group.count > 1 ? `<span class="vault-win__count">x${group.count}</span>` : '');
    dom.history.appendChild(item);
  });

  fitPanels();
}

function renderFairness() {
  const rows = fairness.slice(-FAIRNESS_ROWS).reverse();
  dom.fairness.replaceChildren();
  rows.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'vault-fair-row';
    row.innerHTML =
      '<span class="vault-fair-row__label">Hash</span>' +
      `<code class="vault-fair-row__value">${escapeHtml(entry.seedHash)}</code>` +
      (entry.seed
        ? `<span class="vault-fair-row__label">Secret</span><code class="vault-fair-row__value">${escapeHtml(entry.seed)}</code>`
        : '<span class="vault-fair-row__pending">revealed when the reel stops</span>');
    dom.fairness.appendChild(row);
  });
  dom.fairFoot.textContent = fairness.length
    ? `Showing the last ${rows.length} of ${fairness.length} spins this session.`
    : 'Your spins will be listed here once the first reel starts.';
}

function maxSelectable() {
  const allowance = state.bonus ? state.session.bonusCredits : state.session.spinsRemaining;
  return Math.min(state.session.maxSpinsPerBatch, Math.max(1, allowance));
}

function layOut(counts) {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const limits = new Map();
  counts.forEach((count, tile) => {
    limits.set(tile, Math.max(MAX_RUN, Math.ceil(count / (total - count + 1))));
  });

  const remaining = new Map(counts);
  const strip = [];
  let run = 0;

  while (strip.length < total) {
    const previous = strip.length ? strip[strip.length - 1] : null;
    const left = [...remaining].filter(([, count]) => count > 0);
    const leftTotal = left.reduce((sum, [, count]) => sum + count, 0);

    let options = left.filter(([tile, count]) => count > limits.get(tile) * (leftTotal - count));
    if (!options.length) options = left;

    const spread = options.filter(([tile]) => tile !== previous || run < limits.get(tile));
    if (spread.length) options = spread;

    let roll = Math.random() * options.reduce((sum, [, count]) => sum + count, 0);
    let chosen = options[options.length - 1][0];
    for (const [tile, count] of options) {
      roll -= count;
      if (roll <= 0) {
        chosen = tile;
        break;
      }
    }

    run = chosen === previous ? run + 1 : 1;
    remaining.set(chosen, remaining.get(chosen) - 1);
    strip.push(chosen);
  }

  return strip;
}

function idleStrip() {
  const length = state.session.reelLength || 60;
  const source = state.bonus ? state.session.bonusTiers || [] : state.session.tiers;
  const tiers = source.filter((tier) => tier.weight > 0);
  const total = tiers.reduce((sum, tier) => sum + tier.weight, 0);
  if (!total) return Array.from({ length }, () => 1);

  const counts = new Map();
  tiers.forEach((tier) => counts.set(tier.tier, Math.floor((length * tier.weight) / total)));

  const order = tiers.slice().sort((a, b) => b.weight - a.weight);
  let spare = length - [...counts.values()].reduce((sum, count) => sum + count, 0);
  for (let index = 0; spare > 0; index = (index + 1) % order.length, spare -= 1) {
    counts.set(order[index].tier, counts.get(order[index].tier) + 1);
  }

  return layOut(counts);
}

function makeReel(slot, strip) {
  if (slot.reel) slot.reel.stop();
  slot.reel = createReel({
    canvas: slot.canvas,
    reel: strip,
    durationMs: 0,
    art: state.art,
    reducedMotion: state.reducedMotion,
  });
  slot.reel.onTick((tier, strength) => audio.tick(tier, strength));
  return slot.reel;
}

function buildSlots(count = SLOTS) {
  dom.reels.replaceChildren();
  state.slots = [];

  for (let index = 0; index < count; index += 1) {
    const row = document.createElement('div');
    row.className = 'vault-reel';

    const canvas = document.createElement('canvas');
    canvas.className = 'vault-reel__canvas';
    row.appendChild(canvas);

    const lock = document.createElement('button');
    lock.type = 'button';
    lock.className = 'vault-reel__lock';
    lock.innerHTML = LOCK_ICON + `<span class="vault-reel__lock-text">Coffer ${index + 1}</span>`;
    lock.addEventListener('click', () => unlockTo(index + 1));
    lock.addEventListener('pointerenter', () => audio.hover());
    row.appendChild(lock);

    dom.reels.appendChild(row);

    const slot = { index, row, canvas, lock, reel: null, spinView: null, detached: false };
    state.slots.push(slot);
  }

  state.slots.forEach((slot) => {
    makeReel(slot, idleStrip());
    slot.reel.idle();
  });
}

function unlockTo(target) {
  if (state.spinning || state.transition) {
    audio.denied();
    return;
  }
  if (target > maxSelectable()) {
    audio.denied();
    return;
  }
  state.count = target;
  updateSpinControls();
  audio.stepper(1);
}

function updateLocks() {
  const live = state.spinning ? state.batch : state.count;
  const max = maxSelectable();
  state.slots.forEach((slot) => {
    slot.row.classList.toggle('is-locked', slot.index >= live);
    slot.row.classList.toggle('is-unavailable', slot.index >= max);
    slot.lock.setAttribute('aria-label', slot.index < max
      ? `Open ${slot.index + 1} coffer${slot.index ? 's' : ''}`
      : `Coffer ${slot.index + 1} is not available`);
  });
}

function setOff(element, off) {
  element.classList.toggle('is-off', off);
  if (off) element.setAttribute('aria-disabled', 'true');
  else element.removeAttribute('aria-disabled');
}

function isOff(element) {
  return element.getAttribute('aria-disabled') === 'true';
}

function setBusy(element, busy) {
  element.classList.toggle('is-busy', busy);
  if (busy) element.setAttribute('aria-busy', 'true');
  else element.removeAttribute('aria-busy');
}

function updateSpinControls() {
  const remaining = state.bonus ? state.session.bonusCredits : state.session.spinsRemaining;
  const max = maxSelectable();
  if (state.count > max) state.count = max;
  dom.count.textContent = String(state.count);

  dom.spins.textContent = String(remaining);
  const granted = state.bonus ? state.batch || state.count : state.session.spinsGranted || 0;
  dom.spinsTotal.textContent = granted ? `/ ${granted}` : '';
  dom.spinsBar.style.width = granted
    ? `${Math.max(0, Math.min(100, (remaining / granted) * 100))}%`
    : '0%';

  dom.countGroup.hidden = state.bonus;
  const held = state.spinning || !!state.transition;
  setOff(dom.countUp, state.bonus || held || state.count >= max);
  setOff(dom.countDown, state.bonus || held || state.count <= 1);
  setOff(dom.spinButton, held || remaining <= 0);
  setBusy(dom.spinButton, state.spinning);
  if (state.transition === 'enter') {
    dom.spinLabel.textContent = 'Bonus!';
  } else if (state.spinning) {
    dom.spinLabel.textContent = 'Spinning';
  } else if (remaining <= 0) {
    dom.spinLabel.textContent = state.bonus ? 'Bonus over' : 'No spins left';
  } else if (state.bonus) {
    dom.spinLabel.textContent = state.count > 1 ? `Spin ${state.count} Free` : 'Spin Free';
  } else {
    dom.spinLabel.textContent = state.count > 1 ? `Spin ${state.count}` : 'Spin';
  }
  updateLocks();
}

function remeasure() {
  fitStage();
  state.slots.forEach((slot) => {
    if (slot.reel) slot.reel.resize();
  });
  fitPanels();
}

function applyBonusEnter(reels) {
  state.bonus = true;
  state.countBeforeBonus = state.count;
  state.count = Math.max(1, Math.min(SLOTS, reels));

  document.body.classList.add('is-bonus');
  renderGuide();

  fitStage();
  buildSlots(state.count);
  fitPanels();
  updateSpinControls();

  setStatus('');
}

function applyBonusExit() {
  state.bonus = false;
  state.count = Math.max(1, Math.min(state.countBeforeBonus || 1, maxSelectable()));

  document.body.classList.remove('is-bonus');
  renderGuide();

  fitStage();
  buildSlots();
  fitPanels();
  updateSpinControls();
  setStatus('');
}

function afterTransition() {
  state.transition = '';
  remeasure();
  updateSpinControls();
  syncBonus();
  announceIfDone();
}

function announceIfDone() {
  if (state.spinning || state.transition || state.bonus || !state.session) return;
  if ((state.session.bonusCredits || 0) > 0 || state.session.spinsRemaining > 0) return;
  setStatus('That is all your spins. Your host will trade you shortly.');
  audio.spinsDone();
}

function enterBonus(reels, { animate = true } = {}) {
  if (state.bonus || state.transition) return;

  if (!animate) {
    applyBonusEnter(reels);
    gold.setBonus(true);
    requestAnimationFrame(remeasure);
    return;
  }

  state.transition = 'enter';
  updateSpinControls();
  audio.bonusStart();
  audio.preloadTrack('bonus');
  audio.setTrack('bonus', { out: 1100, in: 1500, delay: 700 });
  gold.ascend(() => applyBonusEnter(reels)).then(afterTransition);
}

function exitBonus({ animate = true } = {}) {
  if (!state.bonus || state.transition) return;

  if (!animate) {
    applyBonusExit();
    gold.setBonus(false);
    requestAnimationFrame(remeasure);
    return;
  }

  state.transition = 'exit';
  updateSpinControls();
  audio.bonusEnd();
  audio.setTrack('theme', { out: 900, in: 1300, delay: 500 });
  gold.descend(applyBonusExit).then(afterTransition);
}

function syncBonus({ animate = true } = {}) {
  if (state.spinning || state.transition || !state.session) return;
  if (!dom.open.classList.contains('hidden')) return;

  const credits = state.session.bonusCredits || 0;
  if (state.bonus) {
    if (credits <= 0) exitBonus({ animate });
    return;
  }
  if (credits > 0) enterBonus(credits, { animate });
}

function armSlot(slot, view) {
  slot.spinView = view;
  slot.detached = false;
  makeReel(slot, view.reel);
  return slot;
}

async function runReel(slot, stopAt) {
  audio.reelStarted(slot);
  slot.reel.start();

  const wait = Math.max(0, slot.spinView.revealAfterMs);
  await new Promise((resolve) => window.setTimeout(resolve, wait));

  let response = await reveal(state.token, slot.spinView.spinId);
  let attempts = 0;
  while (!response.ok && (response.status === 425 || response.status === 0) && attempts < 12) {
    attempts += 1;
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    response = await reveal(state.token, slot.spinView.spinId);
  }

  if (!response.ok) {
    slot.reel.stop();
    audio.reelEnded(slot);
    if (slot.detached) return null;
    setStatus(response.error || 'Could not read the result. Refresh the page to see it.', true);
    return null;
  }

  const payload = response.data;
  const record = fairness.find((item) => item.spinId === payload.spinId);
  if (record) record.seed = payload.seed;

  const landed = new Promise((resolve) => slot.reel.onLanded(resolve));
  slot.reel.land(payload.landingIndex, stopAt - performance.now());
  await landed;

  audio.reelEnded(slot);
  if (slot.detached) return payload;
  audio.reelStop();
  audio.rarity(payload.tier);
  return payload;
}

function trackFairness(views) {
  views.forEach((view) => fairness.push({ spinId: view.spinId, seedHash: view.seedHash, seed: null }));
  if (fairness.length > FAIRNESS_ROWS * 4) fairness.splice(0, fairness.length - FAIRNESS_ROWS * 4);
}

const boxPayloads = new WeakMap();
let collectTimer = 0;

function showOpenAction(shut) {
  if (shut > 0) {
    dom.openAll.textContent = shut > 1 ? 'Open All' : 'Open';
    dom.openClose.hidden = true;
    dom.openAll.hidden = false;
    return;
  }
  dom.openAll.hidden = true;
  dom.openClose.hidden = false;
}

let batchHasBonus = false;

function openNote(remaining, total) {
  if (remaining === 0) {
    return batchHasBonus
      ? 'Collect to play your bonus.'
      : 'All opened. Everything is in Your Wins.';
  }
  if (remaining === total) return total > 1 ? 'Tap a coffer to open it.' : 'Tap your coffer to open it.';
  return `${remaining} still to open.`;
}

function revealBox(box, payload) {
  if (box.dataset.opened === 'true') return;
  box.classList.remove('is-shaking');
  box.classList.add('is-open');
  box.dataset.opened = 'true';
  box.dataset.opening = 'false';

  const url = imageUrl(payload.prize.imageRef);
  const face = box.querySelector('.open-box__face');
  if (face) face.remove();
  const prize = document.createElement('span');
  prize.className = 'open-box__prize';
  prize.innerHTML =
    (url ? `<img class="open-box__prize-image" src="${escapeHtml(url)}" alt="" />` : '') +
    `<span class="open-box__tier">${escapeHtml(tierLabel(payload.tier))}</span>` +
    `<span class="open-box__prize-name">${escapeHtml(payload.prize.name)}</span>`;
  box.appendChild(prize);

  state.revealed.add(payload.spinId);
}

function afterOpen() {
  renderHistory(state.results);
  const boxes = [...dom.openGrid.children];
  const left = boxes.filter((entry) => entry.dataset.opened !== 'true').length;
  dom.openNote.textContent = openNote(left, boxes.length);

  window.clearTimeout(collectTimer);
  if (left > 0) {
    showOpenAction(left);
    return;
  }

  const wait = state.reducedMotion ? REVEAL_REDUCED_MS : REVEAL_MS;
  collectTimer = window.setTimeout(() => showOpenAction(0), wait);
}

function openBox(box, payload) {
  if (box.dataset.opened === 'true' || box.dataset.opening === 'true') return;
  box.dataset.opening = 'true';

  const shake = SHAKE_MS[Math.min(SHAKE_MS.length - 1, Math.max(0, payload.tier - 1))];
  box.style.setProperty('--shake-ms', `${shake}ms`);
  box.style.setProperty('--shake', `${4 + payload.tier * 1.6}px`);
  box.classList.add('is-shaking');
  audio.boxShake(payload.tier, shake);

  window.setTimeout(() => {
    if (box.dataset.opened === 'true') return;
    revealBox(box, payload);
    audio.boxOpen(payload.tier);
    if (payload.tier >= 4) audio.duckMusic(payload.tier >= 5 ? 3.4 : 1.8);
    afterOpen();
  }, shake);
}

function openAll() {
  const shut = [...dom.openGrid.children].filter((box) => box.dataset.opened !== 'true');
  if (!shut.length) return;

  let best = 0;
  shut.forEach((box) => {
    const payload = boxPayloads.get(box);
    if (!payload) return;
    best = Math.max(best, payload.tier);
    revealBox(box, payload);
  });

  audio.openAll(best, shut.length);
  if (best >= 4) audio.duckMusic(best >= 5 ? 3.4 : 1.8);
  afterOpen();
}

function openBoxes(payloads) {
  payloads.forEach((payload) => {
    if (!state.results.some((result) => result.spinId === payload.spinId)) {
      state.results.push(payload);
    }
  });

  dom.openGrid.replaceChildren();
  dom.openGrid.style.setProperty('--coffers', payloads.length);
  payloads.forEach((payload) => {
    const box = document.createElement('button');
    box.type = 'button';
    box.className = payload.isBonus ? 'open-box is-bonus' : 'open-box';
    box.style.setProperty('--tier-colour', colourFor(payload.tier));
    box.setAttribute('aria-label', payload.isBonus
      ? 'Open a bonus coffer'
      : `Open a ${tierLabel(payload.tier)} coffer`);
    const decoded = state.art[payload.tier];
    const face = (decoded && decoded.src) || cofferUrl(payload.tier);
    const open = openChestUrl(payload.tier);
    box.innerHTML =
      '<span class="open-box__burst" aria-hidden="true"></span>' +
      (open ? `<img class="open-box__open" src="${escapeHtml(open)}" alt="" />` : '') +
      '<span class="open-box__face">' +
      `<img class="open-box__coffer" src="${escapeHtml(face)}" alt="" />` +
      `<span class="open-box__tier">${escapeHtml(tierLabel(payload.tier))}</span>` +
      '</span>';
    boxPayloads.set(box, payload);
    box.addEventListener('click', () => openBox(box, payload));
    box.addEventListener('pointerenter', () => audio.hover());
    dom.openGrid.appendChild(box);

    if (payload.isBonus) revealBox(box, payload);
  });

  batchHasBonus = payloads.some((payload) => payload.isBonus);
  const shut = payloads.filter((payload) => !payload.isBonus).length;
  dom.openNote.textContent = openNote(shut, payloads.length);
  window.clearTimeout(collectTimer);
  showOpenAction(shut);
  setModal(dom.howto, false);
  setModal(dom.open, true);

  if (batchHasBonus) {
    audio.preloadTrack('bonus');
    audio.reveal(BONUS_OUTCOME);
  }
}

function closeBoxes() {
  window.clearTimeout(collectTimer);
  [...dom.openGrid.children].forEach((box) => {
    const payload = boxPayloads.get(box);
    if (payload) state.revealed.add(payload.spinId);
  });
  renderHistory(state.results);
  setModal(dom.open, false);
  syncBonus();
}

async function doSpin() {
  if (state.spinning || state.transition || isOff(dom.spinButton)) {
    audio.denied();
    return;
  }
  state.spinning = true;
  state.batch = state.count;
  audio.spinStart();
  setStatus('');
  updateSpinControls();

  const response = await spin(state.token, state.count, uuid(), state.bonus);
  if (!response.ok) {
    state.spinning = false;
    state.batch = 0;
    setStatus(response.error || 'Could not start the spin.', true);
    updateSpinControls();
    return;
  }

  const views = response.data;
  if (state.bonus) state.session.bonusCredits -= views.length;
  else state.session.spinsRemaining -= views.length;
  state.batch = views.length;

  state.slots.forEach((slot) => {
    if (slot.spinView) slot.detached = true;
  });
  audio.reset();

  const live = views.map((view, index) => armSlot(state.slots[index], view));
  updateSpinControls();
  trackFairness(views);

  const results = await Promise.all(live.map((slot, index) => runReel(slot, stopTime(views, index))));
  await finishBatch(results.filter(Boolean));
}

function stopTime(views, index) {
  const base = performance.now() + views[0].revealAfterMs;
  return base + SETTLE_TOTAL_MS + index * STOP_STAGGER_MS;
}

async function finishBatch(landed) {
  const won = landed.filter((payload) => !payload.isNoWin);

  if (won.length) {
    await delay(OPEN_DELAY_MS);
    openBoxes(won);
  } else if (landed.length) {
    setStatus(landed.length > 1 ? 'No luck this time. All empty.' : 'No luck this time.');
  }

  await settleBatch();
}

async function settleBatch() {
  const refreshed = await getPlayState(state.token);
  if (refreshed.ok) {
    state.session = refreshed.data;
    state.results = refreshed.data.results;
    renderGuide();
  }
  renderHistory(state.results);

  state.spinning = false;
  state.batch = 0;
  updateSpinControls();
  syncBonus();
  announceIfDone();
}

async function restore(session) {
  session.results.forEach((result) => state.revealed.add(result.spinId));
  state.results = session.results;
  renderHistory(state.results);
  if (!session.pending.length) {
    syncBonus({ animate: false });
    return;
  }

  if (session.pending[0].fromBonus) enterBonus(session.pending.length, { animate: false });

  state.spinning = true;
  state.batch = session.pending.length;
  state.count = Math.min(session.pending.length, SLOTS);
  const live = session.pending.map((view, index) => armSlot(state.slots[index], view));
  updateSpinControls();
  trackFairness(session.pending);

  const results = await Promise.all(
    live.map((slot, index) => runReel(slot, stopTime(session.pending, index)))
  );
  await finishBatch(results.filter(Boolean));
}

function howtoStepList() {
  const session = state.session;
  const hasNoWin = Boolean(session && session.tiers.some((tier) => tier.tier === NO_WIN_OUTCOME));
  const steps = [
    ['Your link is your vault', 'This link is yours alone and it carries your spins with it, so keep hold of it.'],
    ['Open your coffers', 'Set how many coffers to open with the stepper, then hit Spin. Each coffer costs one spin.'],
    ['Read the reel', hasNoWin
      ? 'Whatever stops under the gold marker is yours. Coffers run from common up to legendary, and the red one is a miss with nothing to open. The Win Guide lists every prize left and the live odds.'
      : 'Whatever stops under the gold marker is yours. Coffers run from common up to legendary, and the Win Guide lists every prize left and the live odds.'],
  ];

  if (session && session.bonusEnabled) {
    steps.push([
      session.bonusLabel || 'Bonus Game',
      'Land the orange one and you win a free round. Collect it, the vault turns gold, and you spin once for every one you landed on reels that always pay. None of it comes off your spin total.',
    ]);
  }

  steps.push([
    'Trade with your host',
    'Everything you win is listed under Your Wins. Show your host and they will hand the prizes over in game.',
  ]);
  return steps;
}

function renderHowto() {
  dom.howtoSteps.innerHTML = howtoStepList().map(([title, body], index) => `
    <li>
      <span class="howto-steps__num">${index + 1}</span>
      <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>
    </li>`).join('');
}

function setModal(modal, open, onOpen) {
  const was = !modal.classList.contains('hidden');
  if (was === open) return;
  modal.classList.toggle('hidden', !open);
  if (open) {
    if (onOpen) onOpen();
    audio.modalOpen();
  } else {
    audio.modalClose();
  }
}

dom.howtoOpen.addEventListener('click', () => setModal(dom.howto, true, renderHowto));
dom.howtoClose.addEventListener('click', () => setModal(dom.howto, false));
dom.howto.addEventListener('click', (event) => {
  if (event.target === dom.howto) setModal(dom.howto, false);
});

dom.fairOpen.addEventListener('click', () => setModal(dom.fair, true, renderFairness));
dom.fairClose.addEventListener('click', () => setModal(dom.fair, false));
dom.fair.addEventListener('click', (event) => {
  if (event.target === dom.fair) setModal(dom.fair, false);
});

dom.openAll.addEventListener('click', openAll);
dom.openAll.addEventListener('pointerenter', () => audio.hover());
dom.openClose.addEventListener('click', closeBoxes);

function canCollect() {
  return !dom.open.classList.contains('hidden') && !dom.openClose.hidden;
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  setModal(dom.howto, false);
  setModal(dom.fair, false);
  if (canCollect()) closeBoxes();
});

function step(delta) {
  const button = delta > 0 ? dom.countUp : dom.countDown;
  if (isOff(button)) {
    audio.denied();
    return;
  }
  state.count = Math.max(1, state.count + delta);
  updateSpinControls();
  audio.stepper(delta);
}

dom.countUp.addEventListener('click', () => step(1));
dom.countDown.addEventListener('click', () => step(-1));
dom.spinButton.addEventListener('click', doSpin);
dom.spinButton.addEventListener('pointerenter', () => audio.hover());
dom.countUp.addEventListener('pointerenter', () => audio.hover());
dom.countDown.addEventListener('pointerenter', () => audio.hover());
dom.howtoOpen.addEventListener('pointerenter', () => audio.hover());
dom.fairOpen.addEventListener('pointerenter', () => audio.hover());
dom.back.addEventListener('click', () => audio.click());
dom.back.addEventListener('pointerenter', () => audio.hover());

function fitStage() {
  const header = document.querySelector('.race-header');
  const nav = document.querySelector('.vault-nav');
  if (!header || !nav || dom.main.hidden) return;
  const chrome = header.offsetHeight + nav.offsetHeight + 88;
  const height = Math.max(360, window.innerHeight - chrome);
  dom.main.style.setProperty('--stage-h', `${height}px`);
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    placeActions();
    remeasure();
    gold.resize();
  }, 80);
});

audio.init();
gold.init();

async function init() {
  if (!state.token) {
    showClosed('No vault link', 'Ask your host for a link to open a vault.');
    return;
  }

  const response = await getPlayState(state.token);
  if (!response.ok) {
    if (response.status === 404) {
      showClosed('This vault link is not valid', 'It may have expired. Ask your host for a new one.');
    } else {
      showClosed('Could not reach the vault', response.error || 'Please try again in a moment.');
    }
    return;
  }

  state.session = response.data;
  if (state.session.status === 'closed') {
    showClosed('This vault has closed', 'Speak to your host if you would like another go.');
    return;
  }

  await preload(state.session);

  dom.venue.textContent = state.session.venueName
    ? `${state.session.venueName} presents a vault for ${state.session.playerName}`
    : `A vault for ${state.session.playerName}`;
  renderGuide();

  dom.loader.hidden = true;
  dom.main.hidden = false;
  placeActions();
  fitStage();
  buildSlots();
  fitPanels();
  updateSpinControls();
  audio.vaultOpen();
  setModal(dom.howto, true, renderHowto);

  await restore(state.session);
}

init();
