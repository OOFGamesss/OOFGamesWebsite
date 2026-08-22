import './race.css';
import { getState, houseBet, houseMe, login, me, placeBet, raceSocketUrl, uuid } from '../../api/chocobo-racing-client.js';
import { openLoginModal } from '../../components/login-modal.js';
import { mountChat } from '../../components/chat/chat-panel.js';
import { chatBases } from '../../api/chocobo-racing-client.js';
import audio from './race-audio.js';

const RACE_PREFIX = '/chocobo-racing/race/';

const LANE_COLORS = ['#DD4A4A', '#4A90E2', '#4AD24A', '#D2D24A', '#D24AC0', '#4A80D2', '#FF6666', '#B0B0B0', '#FFC040', '#40FFFF'];

const SPRITE_SHEET = '/game-assets/chocobo-racing/chocobo-sprite.png';

const el = (id) => document.getElementById(id);
const fmtGil = (n) => `${Number(n || 0).toLocaleString('en-GB')}`;
const digitsOf = (s) => String(s ?? '').replace(/\D/g, '');
const groupGil = (s) => { const d = digitsOf(s); return d ? Number(d).toLocaleString('en-GB') : ''; };

const bankDisplay = { available: null, balance: null, pending: null };
const bankAnims = {};

function cancelBankAnim(key) {
  if (bankAnims[key]) {
    cancelAnimationFrame(bankAnims[key]);
    delete bankAnims[key];
  }
}

function resetBankDisplay() {
  for (const key of Object.keys(bankAnims)) cancelBankAnim(key);
  bankDisplay.available = null;
  bankDisplay.balance = null;
  bankDisplay.pending = null;
}

function animateGil(node, key, to) {
  if (!node) return;
  const target = Math.max(0, Math.floor(Number(to) || 0));
  const from = bankDisplay[key];
  if (from == null || from === target) {
    cancelBankAnim(key);
    bankDisplay[key] = target;
    node.textContent = fmtGil(target);
    node.classList.remove('is-up', 'is-down');
    return;
  }

  cancelBankAnim(key);
  const start = performance.now();
  const delta = target - from;
  const dur = Math.min(1100, Math.max(450, 380 + Math.log10(Math.abs(delta) + 1) * 160));
  node.classList.toggle('is-up', delta > 0);
  node.classList.toggle('is-down', delta < 0);

  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - (1 - t) ** 3;
    const cur = Math.round(from + delta * eased);
    bankDisplay[key] = cur;
    node.textContent = fmtGil(cur);
    if (t < 1) {
      bankAnims[key] = requestAnimationFrame(tick);
      return;
    }
    bankDisplay[key] = target;
    node.textContent = fmtGil(target);
    node.classList.remove('is-up', 'is-down');
    delete bankAnims[key];
  };
  bankAnims[key] = requestAnimationFrame(tick);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SPRITE_BASE_HUE = 45;

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function spriteTint(hex) {
  const { h, s } = rgbToHsl(...hexToRgb(hex));
  const hue = ((h - SPRITE_BASE_HUE) % 360 + 360) % 360;
  const sat = s < 0.12 ? 0 : 1.1;
  return { hue, sat };
}

function phaseLabel(phase) {
  switch (phase) {
    case 'Betting': return 'Betting Open';
    case 'BetsClosed': return 'Betting Closed';
    case 'Racing': return 'Racing';
    case 'Finished': return 'Finished';
    case 'Idle': return 'Taking Banks';
    default: return phase || '-';
  }
}

function getSessionId() {
  const path = window.location.pathname;
  if (path.startsWith(RACE_PREFIX)) {
    const rest = path.slice(RACE_PREFIX.length).replace(/\/+$/, '');
    if (rest) return decodeURIComponent(rest);
  }
  return new URLSearchParams(window.location.search).get('s');
}

function runnerSvg(color) {
  return `
  <svg class="cr-choco" viewBox="0 0 72 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g class="legs" stroke="#3a2a12" stroke-width="3.5" stroke-linecap="round">
      <line class="cr-leg cr-leg--a" x1="30" y1="38" x2="30" y2="52"/>
      <line class="cr-leg cr-leg--b" x1="40" y1="38" x2="40" y2="52"/>
    </g>
    <g class="cr-tail" fill="${color}">
      <path d="M12 26 L2 18 L14 22 Z"/><path d="M12 30 L1 28 L14 28 Z"/><path d="M12 34 L3 40 L15 34 Z"/>
    </g>
    <ellipse cx="34" cy="32" rx="20" ry="13" fill="${color}"/>
    <ellipse cx="30" cy="32" rx="9" ry="7" fill="rgba(0,0,0,0.12)"/>
    <path d="M50 26 C 52 12, 60 8, 58 4 C 64 8, 60 22, 56 30 Z" fill="${color}"/>
    <circle cx="59" cy="9" r="7" fill="${color}"/>
    <circle cx="61" cy="8" r="1.7" fill="#1a1208"/>
    <polygon points="66,9 74,11 66,14" fill="#ff9b1f"/>
    <path d="M52 6 C 55 -1, 61 -1, 64 4" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

const sessionId = getSessionId();
const isHouse = (sessionId || '').toLowerCase() === 'house';
const tokenKey = sessionId && !isHouse ? `cr_token_${sessionId}` : null;

let currentState = null;
let token = tokenKey ? sessionStorage.getItem(tokenKey) : null;
let chatPanel = null;

const MODAL_IDS = ['howto-modal', 'pin-modal', 'pin-changed-modal', 'account-login-modal'];
let player = null;
let balance = 0;
let available = 0;
const selection = new Map();
let myBets = [];
let trackSig = '';
let standingsSig = '';
let yalmsSuffix = null;
let yalmsLead = null;
let venueSig = '';
let ws = null;
let reconnectDelay = 1000;
let ended = false;

let lastPhase = null;
let countdownActive = false;
let countdownTimers = [];
let finishPending = false;
let finishTimer = null;
let announcedWinner = null;
let placingBet = false;

const RAFFLE_MS_PER_YALM = 1000;
const RAFFLE_COUNTDOWN_MS = 3000;
const RAFFLE_RENDER_MS = 33;
let raffleStartTimer = null;
let rafflePlan = [];
let raffleRaf = 0;
let raffleLastRender = 0;
let raffleStartTs = 0;
let raffleDurationMs = 20000;
let raffleLastPhase = null;
let raffleCloseTimer = null;
const rafflePos = new Map();

let rollCount = 0;
let lastKwehRoll = -999;
let prevLeaderNum = null;

const COUNT_STEP_MS = 800;
const GO_HOLD_MS = 600;
const FINISH_REVEAL_MS = 1800;
const COUNTDOWN_COLORS = ['#ffd23f', '#4dd2ff', '#ff6ec7', '#7aa7ff'];
let countdownColorIdx = 0;

const laneColor = (n) => LANE_COLORS[(n - 1) % LANE_COLORS.length];

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const raffleColor = (n) => hslToHex((n * 47) % 360, 68, 56);
const isRaffle = (s) => !!s && s.mode === 'grand_national';
const colorFor = (n) => (isRaffle(currentState) ? raffleColor(n) : laneColor(n));

const chocoboName = (n) => {
  const c = (currentState?.chocobos || []).find((x) => x.number === n);
  return c ? c.name : `Chocobo ${n}`;
};

const currentNameFor = (n, stored) => {
  const c = (currentState?.chocobos || []).find((x) => x.number === n);
  return c ? c.name : (stored || `Chocobo ${n}`);
};
const oddsValue = () => (currentState?.odds || 0);

function renderHeader(s) {
  const host = s.hostName || 'Unknown host';
  el('host-line').textContent = `Hosted by ${host}${s.venueName ? ` · ${s.venueName}` : ''}`;
  renderStatsBar(s);
  renderTrackStatus(s);
}

function renderStatsBar(s) {
  setStatLabel('stat-round', 'Round');
  el('stat-round').textContent = s.round ?? '-';
  el('stat-payout').textContent = s.odds ? `${s.odds}x` : '-';
  el('stat-track').textContent = s.finishLine ? `${s.finishLine} yalms` : '-';
  el('stat-entry-wrap').classList.add('hidden');
  const pw = el('stat-perfect-wrap');
  if (s.perfectRace && s.perfectRaceOdds) {
    el('stat-perfect').textContent = `${s.perfectRaceOdds}x`;
    pw.classList.remove('hidden');
  } else {
    pw.classList.add('hidden');
  }
}

function renderTrackStatus(s) {
  const show = s.phase === 'Idle' || s.phase === 'Betting' || s.phase === 'BetsClosed';
  const ov = el('track-status');
  ov.classList.toggle('hidden', !show);
  if (show) ov.querySelector('.track-status__text').textContent = phaseLabel(s.phase);
}

const spriteSizeFor = (n) => (n <= 6 ? 68 : n <= 8 ? 58 : 50);

function ensureTrack(s) {
  const chocobos = s.chocobos || [];
  const sig = `${s.mode || 'classic'}|` + chocobos.map((c) => `${c.number}:${c.name}`).join('|');
  if (sig === trackSig) return;
  trackSig = sig;
  const n = chocobos.length;
  const gn = isRaffle(s);
  const RAFFLE_MIN_CHOCOBOS = 5;
  const sizeN = gn ? Math.max(n, RAFFLE_MIN_CHOCOBOS) : n;
  const track = el('track');
  const sprite = spriteSizeFor(sizeN);
  const grassTop = 112;
  const rowStep = sprite + 14;
  track.style.setProperty('--sprite-size', `${sprite}px`);
  track.style.setProperty('--grass-top', `${grassTop}px`);

  const rows = gn ? Math.min(sizeN, 10) : n;
  const trackH = grassTop + rows * rowStep + 36;
  track.style.height = `${trackH}px`;

  const view = el('race-view');
  if (view) view.style.setProperty('--track-h', `${trackH}px`);

  const half = sprite / 2;
  const usableTop = grassTop + half + 12;
  let usableBottom = trackH - (gn ? 132 : 78) - half;
  if (usableBottom < usableTop + sprite) usableBottom = usableTop + sprite;
  const usableH = usableBottom - usableTop;
  const spacing = sprite * 0.8;
  const packSpan = spacing * Math.max(0, sizeN - 1);
  const realSpacing = packSpan <= usableH ? spacing : usableH / Math.max(1, sizeN - 1);
  const startY = (usableTop + usableBottom) / 2 - (realSpacing * (n - 1)) / 2;
  el('runners-layer').innerHTML = chocobos.map((c, i) => {
    const color = colorFor(c.number);
    const jitter = ((i * 53) % 13) - 6;
    const packTop = Math.max(usableTop, Math.min(usableBottom, Math.round(startY + i * realSpacing + jitter)));
    const laneTop = gn ? packTop : grassTop + i * rowStep + rowStep / 2;
    const tint = spriteTint(color);
    const wanted = 5 + ((i * 29) % 10);
    const jamp = Math.max(3, Math.round(Math.min(wanted, packTop - usableTop, usableBottom - packTop)));
    const jdur = (1.5 + ((i * 17) % 13) / 10).toFixed(2);
    const jdelay = (-((i * 11) % 20) / 10).toFixed(2);
    const janim = ['jostle', 'jostle2', 'jostle3'][i % 3];
    return `
      <div class="runner" data-runner="${c.number}" data-lane-top="${laneTop}" data-pack-top="${packTop}"
           style="top:${laneTop}px; --jamp:${jamp}px; --jdur:${jdur}s; --jdelay:${jdelay}s; --janim:${janim}">
        <div class="runner__jostle">
          <span class="runner__label">
            <span class="runner__num" style="background:${color}">${c.number}</span>
            <span class="runner__name" style="color:${color}">${escapeHtml(c.name)}</span>
          </span>
          <div class="runner__body"><div class="runner__bob">
            <div class="dust"><span></span><span></span><span></span></div>
            <div class="runner-sprite" style="--hue:${tint.hue}deg; --sat:${tint.sat}"></div>
            ${runnerSvg(color)}
          </div></div>
        </div>
      </div>`;
  }).join('');
  fitRunnerNames();
  measureTrack();
  watchTrackWidth();
}

let trackWidth = 0;
let trackResizeObserver = null;

function measureTrack() {
  const track = el('track');
  if (track) trackWidth = track.clientWidth || trackWidth;
}

function watchTrackWidth() {
  if (trackResizeObserver || typeof ResizeObserver === 'undefined') return;
  const track = el('track');
  if (!track) return;
  trackResizeObserver = new ResizeObserver(() => {
    const before = trackWidth;
    measureTrack();
    if (trackWidth !== before && currentState) updateRunners(currentState);
  });
  trackResizeObserver.observe(track);
}

function fitRunnerNames() {
  const LABEL_MAX = 88;
  const BASE_REM = 0.9;
  const labels = [...el('runners-layer').querySelectorAll('.runner__label')];
  const names = labels.map((label) => label.querySelector('.runner__name'));
  names.forEach((name) => { if (name) name.style.fontSize = ''; });
  const measured = labels.map((label, i) => ({
    label: label.scrollWidth,
    name: names[i] ? names[i].scrollWidth : 0,
  }));
  names.forEach((name, i) => {
    const { label, name: nameWidth } = measured[i];
    if (!name || label <= LABEL_MAX || nameWidth <= 0) return;
    const room = LABEL_MAX - (label - nameWidth);
    const wanted = room > 0 ? (BASE_REM * room) / nameWidth : 0;
    const size = Math.max(0.55, Math.min(BASE_REM, Math.floor(wanted * 20) / 20));
    name.style.fontSize = `${size}rem`;
  });
}

if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitRunnerNames);

function updateRunners(s) {
  const track = el('track');
  if (!trackWidth) measureTrack();
  const racing = s.phase === 'Racing' && !countdownActive;
  track.classList.toggle('is-racing', racing);
  const finish = s.finishLine || 1;
  (s.chocobos || []).forEach((c) => {
    const r = track.querySelector(`.runner[data-runner="${c.number}"]`);
    if (!r) return;
    const p = countdownActive ? 0 : Math.max(0, Math.min(1, finish ? c.position / finish : 0));
    r.style.transform = `translate3d(${(Math.max(0, trackWidth - 86) * p + 6).toFixed(2)}px, -50%, 0)`;

    r.style.top = `${racing ? r.dataset.packTop : r.dataset.laneTop}px`;
    r.classList.toggle('won', s.winningChocobo === c.number);
  });
}

function sanitizeImageUrl(u) {
  const s = String(u || '').trim();
  return /^https?:\/\/[^\s"'()]+\.(jpg|jpeg|png|webp)(\?[^\s"'()]*)?$/i.test(s) ? s : '';
}

function renderVenue(s) {
  const layer = el('track-venue');
  const url = sanitizeImageUrl(s.venueImageUrl);
  if (!url) { layer.classList.add('hidden'); layer.style.removeProperty('--venue-img'); venueSig = ''; return; }
  const track = el('track');
  const w = track.clientWidth || 800;
  track.style.setProperty('--venue-dur', `${(w * 2.6 / 128).toFixed(2)}s`);
  track.style.setProperty('--venue-dur-racing', `${(w * 0.7 / 128).toFixed(2)}s`);
  layer.classList.remove('hidden');
  if (url === venueSig) return;
  venueSig = url;
  layer.style.setProperty('--venue-img', `url("${url}")`);
}

function renderStandings(s) {
  const standings = el('standings');

  const active = s.phase === 'Racing';
  standings.classList.toggle('hidden', !active);

  const order = [...(s.chocobos || [])].sort((a, b) => (b.position - a.position) || (a.number - b.number));
  const medals = ['podium--1', 'podium--2', 'podium--3'];
  const shown = isRaffle(s) ? order.slice(0, 5) : order;

  const sig = `${s.mode || 'classic'}|` + shown.map((c) => `${c.number}:${c.name}`).join('|');
  if (sig === standingsSig) { renderYalms(s, order); return; }
  standingsSig = sig;

  standings.innerHTML = shown.map((c, i) => {
    if (i < 3) {
      return `
        <div class="podium ${medals[i]}">
          <span class="podium__rank">${i + 1}</span>
          <span class="podium__chip">
            <span class="podium__silk" style="background:${colorFor(c.number)}">${c.number}</span>
            <span class="podium__name">${escapeHtml(c.name)}</span>
          </span>
        </div>`;
    }
    return `
      <span class="standing">
        <span class="standing__rank">${i + 1}</span>
        <span class="standing__silk" style="background:${colorFor(c.number)}">${c.number}</span>
      </span>`;
  }).join('');

  renderYalms(s, order);
}

function renderYalms(s, order) {
  const box = el('yalms');
  const finish = s.finishLine || 0;
  if (isRaffle(s) || !finish) {
    if (yalmsSuffix !== null) { box.textContent = ''; yalmsSuffix = null; yalmsLead = null; }
    return;
  }
  const suffix = `/${finish} yalms`;
  if (suffix !== yalmsSuffix) {
    yalmsSuffix = suffix;
    yalmsLead = null;
    box.textContent = '';
    box.appendChild(document.createElement('b'));
    box.appendChild(document.createTextNode(suffix));
  }
  const lead = Math.floor(Math.min(order.length ? order[0].position : 0, finish));
  if (lead !== yalmsLead) {
    yalmsLead = lead;
    box.firstChild.textContent = String(lead);
  }
}

function renderPodiumOverlay(s) {
  const overlay = el('podium-overlay');
  if (s.phase !== 'Finished') { overlay.classList.add('hidden'); overlay.innerHTML = ''; return; }
  const order = [...(s.chocobos || [])]
    .sort((a, b) => (b.position - a.position) || (a.number - b.number))
    .slice(0, 3);
  const ranks = ['1st', '2nd', '3rd'];
  const slot = (c, idx) => {
    if (!c) return '';
    const color = laneColor(c.number);
    return `
      <div class="pod pod--${idx + 1}">
        <div class="pod__choco">${runnerSvg(color)}</div>
        <div class="pod__block">
          <span class="pod__rank">${ranks[idx]}</span>
          <span class="pod__silk" style="background:${color}">${c.number}</span>
          <span class="pod__name">${escapeHtml(currentNameFor(c.number, c.name))}</span>
        </div>
      </div>`;
  };

  const odds = s.odds || 0;
  const byPlayer = new Map();
  for (const b of (s.bets || [])) {
    if (b.chocobo !== s.winningChocobo) continue;
    const key = `${b.name}@${b.world || ''}`;
    const prev = byPlayer.get(key);
    byPlayer.set(key, { name: b.name, amount: (prev ? prev.amount : 0) + b.amount });
  }
  const winners = [...byPlayer.values()]
    .map((w) => ({ name: w.name, payout: Math.floor(w.amount * odds) }))
    .sort((a, b) => b.payout - a.payout);
  const winnersHtml = winners.length
    ? winners.map((w) => `
        <div class="pod-winner">
          <span class="pod-winner__name">${escapeHtml(w.name)}</span>
          <span class="pod-winner__amt">${fmtGil(w.payout)}</span>
        </div>`).join('')
    : '<div class="pod-winners__none">Sadly no winners this round!</div>';

  overlay.innerHTML = `
    <div class="podium-overlay__card">
      <h3 class="podium-overlay__title">🏁 Race Finished</h3>
      <div class="podium-overlay__row">${slot(order[1], 1)}${slot(order[0], 0)}${slot(order[2], 2)}</div>
      <hr class="podium-overlay__sep" />
      <h4 class="podium-overlay__winners-h">Winners</h4>
      <div class="pod-winners scroll-area">${winnersHtml}</div>
    </div>`;
  overlay.classList.remove('hidden');
}

function renderAllBets(s) {

  const bets = (s.bets || []).filter((b) => b.status !== 'pending');
  el('all-bets-count').textContent = `${bets.length} bet${bets.length === 1 ? '' : 's'}`;
  if (bets.length === 0) {
    el('all-bets').innerHTML = '<div class="bets-empty">No bets yet - be the first.</div>';
    return;
  }

  const groups = new Map();
  for (const b of bets) {
    if (!groups.has(b.chocobo)) groups.set(b.chocobo, { total: 0, list: [] });
    const g = groups.get(b.chocobo);
    g.total += b.amount;
    g.list.push(b);
  }
  const nums = [...groups.keys()].sort((a, b) => a - b);
  el('all-bets').innerHTML = nums.map((num) => {
    const g = groups.get(num);
    const lines = g.list.map((b) => `
      <div class="bet-line">
        <span class="bet-line__who">${escapeHtml(b.name)}</span>
        <span class="bet-line__amt">${fmtGil(b.amount)}</span>
      </div>`).join('');
    return `
      <div class="bet-group">
        <div class="bet-group__head">
          <span class="bet-group__silk" style="background:${laneColor(num)}">${num}</span>
          <span>${escapeHtml(chocoboName(num))}</span>
          <span class="bet-group__meta">${g.list.length} bet${g.list.length === 1 ? '' : 's'} · ${fmtGil(g.total)}</span>
        </div>
        <div class="bet-group__list">${lines}</div>
      </div>`;
  }).join('');
}

function aggregateMine(bets) {
  const map = new Map();
  for (const b of (bets || [])) {
    if (!map.has(b.chocobo)) map.set(b.chocobo, { chocobo: b.chocobo, amount: 0, status: 'confirmed' });
    const g = map.get(b.chocobo);
    g.amount += b.amount;
    if (b.status === 'pending') g.status = 'pending';
  }
  return [...map.values()].sort((a, b) => a.chocobo - b.chocobo);
}

function renderYourBets(bets) {
  const card = el('your-bets-card');
  const agg = aggregateMine(bets);
  if (!token || agg.length === 0) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  const rows = agg.map((b) => {
    const ret = Math.floor(b.amount * oddsValue());
    const tag = b.status === 'pending' ? '<span class="bets-row__tag tag-pending">PENDING</span>' : '<span class="bets-row__tag tag-confirmed">CONFIRMED</span>';
    return `
      <div class="mybets-row">
        <span class="mybets__sel"><span class="mybets__silk" style="background:${laneColor(b.chocobo)}">${b.chocobo}</span>${escapeHtml(chocoboName(b.chocobo))}</span>
        <span class="mybets__bet">${fmtGil(b.amount)}</span>
        <span class="mybets__win">${fmtGil(ret)}</span>
        <span class="mybets__status">${tag}</span>
      </div>`;
  }).join('');
  el('your-bets').innerHTML = `<div class="mybets__head"><span></span><span>Bet</span><span>To win</span><span></span></div>${rows}`;
}

function renderLastResults(results) {
  const box = el('last-results');
  if (!results || results.length === 0) { box.innerHTML = '<div class="bets-empty">No race results yet</div>'; return; }
  const labels = ['1st', '2nd', '3rd'];
  box.innerHTML = results.map((r) => {
    const podium = (r.order || []).slice(0, 3).map((o, i) => `
      <li class="rp rp--${i + 1}">
        <span class="rp__rank">${labels[i]}</span>
        <span class="rp__silk" style="background:${laneColor(o.number)}">${o.number}</span>
        <span class="rp__name">${escapeHtml(currentNameFor(o.number, o.name))}</span>
      </li>`).join('');
    return `
      <div class="result-item">
        <div class="result-item__head"><span class="result-item__round">Round ${r.round}</span></div>
        <ol class="result-podium">${podium}</ol>
      </div>`;
  }).join('');
}

function renderStats(s) {
  const wins = (s.winCounts || []).map((w) => `
    <div class="stat-win">
      <span class="stat-win__silk" style="background:${laneColor(w.number)}">${w.number}</span>
      <span class="perf-name">${escapeHtml(currentNameFor(w.number, w.name))}</span>
      <span class="stat-win__n">${w.wins} win${w.wins === 1 ? '' : 's'}</span>
    </div>`).join('');
  el('race-stats').innerHTML = `<h3>Wins this session</h3>${wins || '<div class="bets-empty">No wins yet.</div>'}`;
}

function renderRunnerList(s) {
  const chocobos = s.chocobos || [];

  const list = el('runner-list');
  const split = chocobos.length > 5;
  list.classList.toggle('is-split', split);
  list.style.setProperty('--runner-rows', split ? Math.ceil(chocobos.length / 2) : '');
  list.innerHTML = chocobos.map((c) => {
    const color = laneColor(c.number);
    const picked = selection.has(c.number);
    const mine = myBets.filter((b) => b.chocobo === c.number).reduce((t, b) => t + b.amount, 0);
    const youLine = mine > 0 ? `<small class="runner-row__you">${fmtGil(mine)} bet placed.</small>` : '';
    const pickLabel = picked ? 'Remove from Betslip' : 'Add to Betslip';
    return `
      <div class="runner-row ${picked ? 'selected' : ''}" data-num="${c.number}">
        <span class="runner-row__silk" style="background:${color}">${c.number}</span>
        <span class="runner-row__name">${escapeHtml(c.name)}${youLine}</span>
        <span class="runner-row__odds">Odds ${s.odds}x</span>
        <button type="button" class="runner-row__pick" aria-label="${pickLabel}">
          <span class="runner-row__pick-full" aria-hidden="true">${pickLabel}</span>
          <span class="runner-row__pick-short" aria-hidden="true">${picked ? '−' : '+'}</span>
        </button>
      </div>`;
  }).join('');
}

function toggleSelect(num) {
  if (selection.has(num)) selection.delete(num);
  else selection.set(num, '');
  renderRunnerList(currentState);
  renderSlip();
}

function renderSlip() {
  const nums = [...selection.keys()].sort((a, b) => a - b);
  el('slip-count').textContent = String(nums.length);
  el('slip-empty').classList.toggle('hidden', nums.length > 0);
  el('slip-controls').classList.toggle('hidden', nums.length === 0);
  el('slip-lines').innerHTML = nums.map((n) => {
    const stake = selection.get(n) || '';
    const ret = stake ? Math.floor(parseInt(stake, 10) * oddsValue()) : 0;
    return `
      <div class="slip-line" data-line="${n}">
        <span class="slip-line__silk" style="background:${laneColor(n)}">${n}</span>
        <span class="slip-line__name">${escapeHtml(chocoboName(n))}<small>Odds ${oddsValue()}x</small></span>
        <span class="stepper slip-line__stepper">
          <input class="cr-input slip-line__stake" type="text" inputmode="numeric" value="${escapeHtml(groupGil(stake))}" placeholder="Gil" data-stake="${n}" />
          <span class="stepper__arrows">
            <button type="button" class="stepper__btn" data-dir="1" aria-label="Add 1,000">▲</button>
            <button type="button" class="stepper__btn" data-dir="-1" aria-label="Subtract 1,000">▼</button>
          </span>
        </span>
        <button class="slip-line__rm" data-rm="${n}" aria-label="Remove">✕</button>
        <span class="slip-line__ret">${ret ? `returns ${fmtGil(ret)}` : ''}</span>
      </div>`;
  }).join('');
  updateSlipState();
}

function stepStake(input, delta) {
  if (!input) return;
  const n = parseInt(input.dataset.stake, 10);
  const next = Math.min(Math.max(0, (parseInt(digitsOf(input.value), 10) || 0) + delta), betCapFor(n));
  input.value = groupGil(String(next));
  selection.set(n, String(next));
  const ret = next ? Math.floor(next * oddsValue()) : 0;
  const retEl = input.closest('.slip-line').querySelector('.slip-line__ret');
  if (retEl) retEl.textContent = ret ? `returns ${fmtGil(ret)}` : '';
  updateSlipState();
}

function updateSlipState() {
  let total = 0;
  for (const v of selection.values()) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  const ret = Math.floor(total * oddsValue());
  if (el('slip-total')) el('slip-total').textContent = fmtGil(total);
  if (el('slip-return')) el('slip-return').textContent = fmtGil(ret);
  const after = available - total;
  const afterEl = el('slip-after');
  if (afterEl) {
    afterEl.textContent = fmtGil(after);
    afterEl.classList.toggle('text-magenta', after < 0);
  }
  if (el('slip-after-row')) el('slip-after-row').classList.toggle('hidden', !token);
  el('slip-summary-mini').textContent = selection.size ? `${selection.size} pick${selection.size === 1 ? '' : 's'} · ${fmtGil(total)}` : '';
  const betting = currentState?.phase === 'Betting';
  const place = el('place-bet');
  if (placingBet) {
    place.disabled = true;
    place.textContent = 'Placing bet';
    place.classList.add('is-placing');
  } else {
    place.disabled = !betting || total <= 0;
    place.textContent = token ? 'Place Bet' : (isHouse ? 'Log in to bet' : 'Enter PIN to bet');
    place.classList.remove('is-placing');
  }
  el('slip-login-hint').classList.toggle('hidden', !!token || selection.size === 0);

  updatePlayerArea();
}

function betCapFor(n) {
  const cap = currentState?.maxBetPerChocobo || 0;
  if (cap <= 0) return Infinity;
  const placed = myBets
    .filter((b) => b.chocobo === n)
    .reduce((t, b) => t + (b.amount || 0), 0);
  return Math.max(0, cap - placed);
}

function maxBet() {
  const nums = [...selection.keys()].sort((a, b) => a - b);
  if (nums.length === 0) return;
  let pot = Math.max(0, Math.floor(available));
  const alloc = new Map(nums.map((n) => [n, 0]));
  const caps = new Map(nums.map((n) => [n, betCapFor(n)]));
  let active = nums.filter((n) => caps.get(n) - alloc.get(n) > 0);
  while (pot > 0 && active.length > 0) {
    const share = Math.max(1, Math.floor(pot / active.length));
    let progressed = false;
    for (const n of active) {
      if (pot <= 0) break;
      const room = caps.get(n) - alloc.get(n);
      if (room <= 0) continue;
      const add = Math.min(share, room, pot);
      alloc.set(n, alloc.get(n) + add);
      pot -= add;
      progressed = true;
    }
    active = active.filter((n) => caps.get(n) - alloc.get(n) > 0);
    if (!progressed) break;
  }
  for (const n of nums) selection.set(n, String(alloc.get(n)));
  el('stake-all').value = '';
  renderSlip();
}

async function placeBets() {
  if (placingBet) return;
  if (!token) { openModal(); return; }
  if (currentState?.phase !== 'Betting') { slipMsg('Betting is closed.', true); return; }
  const lines = [...selection.entries()]
    .map(([num, stake]) => ({ num, amount: parseInt(stake, 10) }))
    .filter((l) => Number.isFinite(l.amount) && l.amount > 0);
  if (lines.length === 0) { slipMsg('Enter a stake on at least one chocobo.', true); return; }
  const minBet = isHouse ? (currentState?.minBet || 1000) : 0;
  if (minBet && lines.some((l) => l.amount < minBet)) {
    slipMsg(`Minimum bet is ${fmtGil(minBet)} gil per chocobo.`, true);
    return;
  }

  placingBet = true;
  const place = el('place-bet');
  place.disabled = true;
  place.textContent = 'Placing bet';
  place.classList.add('is-placing');

  const errors = [];
  let anyOk = false;
  let revoked = false;
  try {
    for (const line of lines) {
      const res = isHouse
        ? await houseBet(line.num, line.amount, uuid())
        : await placeBet(token, line.num, line.amount, uuid());
      if (res.ok) { anyOk = true; selection.delete(line.num); }
      else if (res.status === 401) { revoked = true; handleTokenRevoked(); break; }
      else errors.push(`#${line.num}: ${res.error}`);
    }
  } finally {
    placingBet = false;
    place.classList.remove('is-placing');
    el('stake-all').value = '';
  }
  if (revoked) return;
  if (anyOk) await refreshMe();
  renderRunnerList(currentState);
  renderSlip();
  if (errors.length) slipMsg(errors.join(' · '), true);
  else hideSlipMsg();
}

let slipMsgTimer = null;

function slipMsg(text, isError) {
  const m = el('slip-msg');
  m.textContent = text;
  m.className = `slip-msg ${isError ? 'err' : 'ok'}`;
  m.classList.remove('hidden');
  if (slipMsgTimer) clearTimeout(slipMsgTimer);
  slipMsgTimer = setTimeout(hideSlipMsg, 3000);
}

function hideSlipMsg() {
  if (slipMsgTimer) { clearTimeout(slipMsgTimer); slipMsgTimer = null; }
  el('slip-msg').classList.add('hidden');
}

function renderPlayer() {
  const box = el('player-box');
  if (token && player) {
    el('open-join').classList.add('hidden');
    box.classList.remove('hidden');
    el('player-name').textContent = player.name;

    const inBets = (myBets || []).reduce((t, b) => t + (b.amount || 0), 0);
    animateGil(el('bank-amount'), 'available', available);
    animateGil(el('bank-balance'), 'balance', balance);
    animateGil(el('bank-pending'), 'pending', inBets);
  } else {
    resetBankDisplay();
    el('open-join').classList.remove('hidden');
    box.classList.add('hidden');
    if (el('bank-amount')) el('bank-amount').textContent = '-';
    if (el('bank-balance')) el('bank-balance').textContent = '-';
    if (el('bank-pending')) el('bank-pending').textContent = '-';
  }
  updatePlayerArea();
}

function updatePlayerArea() {
  const area = el('player-area');
  if (!area) return;
  const betting = currentState?.phase === 'Betting';
  area.classList.toggle('hidden', !(token && betting));
}

async function refreshMe() {
  if (isHouse) {
    const res = await houseMe();
    if (!res.ok) {
      if ((res.status === 401 || res.status === 403) && token) handleTokenRevoked();
      return;
    }
    token = 'house';
    applyMe(res.data);
    return;
  }
  if (!token) return;
  const res = await me(token);
  if (!res.ok) { if (res.status === 401) handleTokenRevoked(); return; }
  applyMe(res.data);
}

function applyMe(data) {
  player = { name: data.name, world: data.world };
  balance = data.balance;
  available = data.available;
  myBets = data.bets || [];
  renderPlayer();
  renderYourBets(data.bets);
  if (currentState) renderRunnerList(currentState);
  updateSlipState();
}

function logout() {
  if (chatPanel) chatPanel.resetIdentity();
  token = null;
  player = null;
  myBets = [];
  if (tokenKey) sessionStorage.removeItem(tokenKey);
  renderPlayer();
  el('your-bets-card').classList.add('hidden');
  if (currentState) renderRunnerList(currentState);
  updateSlipState();
}

function handleTokenRevoked() {
  if (ended) return;
  const hadToken = !!token;
  logout();
  if (!hadToken) return;
  if (isHouse) openHouseLogin();
  else el('pin-changed-modal').style.display = 'flex';
}

function closePinChanged() { el('pin-changed-modal').style.display = 'none'; }

function openHouseLogin() {
  openLoginModal({
    intro: 'House races bet straight from your OOF account wallet. Enter the account token a host gave you in-game and your balance appears right here.',
    onSuccess: () => refreshMe()
  });
}

function openModal() {
  if (isHouse) { openHouseLogin(); return; }
  el('pin-modal').classList.remove('hidden');
  el('pin-input').focus();
}
function closeModal() { el('pin-modal').classList.add('hidden'); el('pin-msg').classList.add('hidden'); el('pin-input').value = ''; }

const HOWTO_RAFFLE_STEPS = [
  ['Trade Gil to your host', 'Pay the entry fee to your race host to join the runner list.'],
  ['Get your chocobo', 'The host adds you to the race and gives you a numbered chocobo carrying your name.'],
  ['Watch the race', 'When the host starts, the server draws the winner and the chocobos race it out.'],
  ['Win the prize', 'If your chocobo is first past the post, you take the prize - the pot, an item, or whatever the host is offering!'],
];

const HOWTO_CLASSIC_STEPS = [
  ['Trade Gil to your host', "Hand over some in-game Gil to your race host so you're ready to bet."],
  ['Get your PIN', 'Your host will give you a 6-digit PIN. Tap "Enter PIN to bet" at the top and enter it to log in.'],
  ['Pick your chocobos', 'Head to the Runners section and tap each chocobo you fancy backing.'],
  ['Set your stakes', 'Open your Bet Slip and type how much Gil you want to bet on each pick.'],
  ['Place your bet', 'Hit "Place Bet", then sit back and wait for the race to begin!'],
];

const HOWTO_HOUSE_STEPS = [
  ['Log in with your OOF account', 'House races bet straight from your OOF account wallet. Log in on the Account page with your OOF token - any OOF host can register you and top up your wallet in game.'],
  ['Pick your chocobos', 'Head to the Runners section and tap each chocobo you fancy backing. Every bird has the same fair chance.'],
  ['Set your stakes', 'Open your Bet Slip and stake 1,000 gil or more per pick. The first bet placed starts the countdown to race time.'],
  ['Watch the race live', 'When betting closes the server rolls the race - first chocobo to the finish line wins.'],
  ['Get paid instantly', 'Winning bets pay 4x straight into your account wallet the moment the race finishes.'],
];

function howToStepsHtml(steps) {
  return steps.map(([title, body], i) => `
    <li>
      <span class="howto-steps__num">${i + 1}</span>
      <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>
    </li>`).join('');
}

function openHowTo() {
  const steps = isHouse ? HOWTO_HOUSE_STEPS : (isRaffle(currentState) ? HOWTO_RAFFLE_STEPS : HOWTO_CLASSIC_STEPS);
  const list = el('howto-steps');
  if (list) list.innerHTML = howToStepsHtml(steps);
  el('howto-modal').classList.remove('hidden');
}

function closeHowTo() { el('howto-modal').classList.add('hidden'); }

async function submitPin(e) {
  e.preventDefault();
  const pin = el('pin-input').value.trim();
  const msg = el('pin-msg');
  if (!/^\d{6}$/.test(pin)) { msg.textContent = 'Enter the 6-digit PIN.'; msg.className = 'slip-msg err'; msg.classList.remove('hidden'); return; }
  const res = await login(sessionId, pin);
  if (!res.ok) {
    msg.textContent = res.status === 429 ? 'Too many attempts - wait a moment.' : (res.error || 'Invalid PIN.');
    msg.className = 'slip-msg err'; msg.classList.remove('hidden');
    return;
  }
  token = res.data.token;
  if (tokenKey) sessionStorage.setItem(tokenKey, token);
  closeModal();
  await refreshMe();
  if (chatPanel) chatPanel.refreshIdentity();
}

function anyModalOpen() {
  return MODAL_IDS.some((id) => {
    const node = el(id);
    return node ? getComputedStyle(node).display !== 'none' : false;
  });
}

function watchModals() {
  const syncChat = () => { if (chatPanel) chatPanel.setBlocked(anyModalOpen()); };
  const watched = new WeakSet();
  const attributes = new MutationObserver(syncChat);
  const watch = (node) => {
    if (!node || watched.has(node)) return;
    watched.add(node);
    attributes.observe(node, { attributes: true, attributeFilter: ['class', 'style'] });
  };
  MODAL_IDS.forEach((id) => watch(el(id)));
  new MutationObserver(() => {
    MODAL_IDS.forEach((id) => watch(el(id)));
    syncChat();
  }).observe(document.body, { childList: true });
  syncChat();
}

function hideLoader() {
  const l = el('track-loader');
  if (l) l.remove();
}

function renderHot(s) {
  updateRunners(s);
  renderStandings(s);
}

function renderAll(s) {
  hideLoader();
  currentState = s;

  if (isRaffle(s)) { renderAllRaffle(s); return; }
  exitRaffleMode();

  const phase = s.phase;
  if (lastPhase && lastPhase !== 'Racing' && phase === 'Racing') startCountdown();
  lastPhase = phase;

  audio.setBgm(phase === 'Racing' || finishPending);
  audio.setLobby(phase === 'Idle' || phase === 'Betting');

  renderHeader(s);
  ensureTrack(s);
  renderVenue(s);
  updateRunners(s);
  renderStandings(s);
  renderRunnerList(s);
  renderAllBets(s);
  renderHouseExtras(s);
  updateSlipState();

  if (!finishPending) {
    renderPodiumOverlay(s);
    renderLastResults((s.results || []).filter((r) => r.mode !== 'grand_national'));
    renderStats(s);
  }
}

function setStatLabel(valueId, text) {
  const v = el(valueId);
  if (!v || !v.parentElement) return;
  const label = v.parentElement.querySelector('.track-stat__label');
  if (label) label.textContent = text;
}

function exitRaffleMode() {
  document.body.classList.remove('is-gn');
  el('all-bets-card')?.classList.remove('hidden');
  el('raffle-runners-card')?.classList.add('hidden');
  const sp = el('race-stats')?.closest('.panel');
  if (sp) sp.classList.remove('hidden');
  setStatLabel('stat-payout', 'Payout Odds');
  setStatLabel('stat-track', 'Track');
  stopRaffleRace();
  if (raffleCloseTimer) { clearInterval(raffleCloseTimer); raffleCloseTimer = null; }
  el('raffle-close')?.classList.add('hidden');
  raffleLastPhase = null;
}

function renderAllRaffle(s) {
  document.body.classList.add('is-gn');
  el('open-join').classList.add('hidden');
  el('all-bets-card')?.classList.add('hidden');
  el('your-bets-card')?.classList.add('hidden');
  el('raffle-runners-card')?.classList.remove('hidden');
  const sp = el('race-stats')?.closest('.panel');
  if (sp) sp.classList.add('hidden');

  audio.setBgm(s.phase === 'Racing');
  audio.setLobby(s.phase === 'Betting' || s.phase === 'BetsClosed');

  renderHeaderRaffle(s);
  syncRaffleChocobos(s);
  ensureTrack(s);
  renderVenue(s);
  handleRafflePhase(s);
  updateRunners(s);
  renderStandings(s);
  renderRafflePodium(s);
  renderRaffleRunners(s);
  renderRaffleCloseTime(s);
  renderLastResultsRaffle((s.results || []).filter((r) => r.mode === 'grand_national'));

  if (!raffleCloseTimer) {
    raffleCloseTimer = setInterval(() => {
      if (currentState && isRaffle(currentState)) renderRaffleCloseTime(currentState);
    }, 1000);
  }
}

function pad2(n) {
  return String(Number(n) || 0).padStart(2, '0');
}

function raffleCloseSecs(hour, minute) {
  const now = Date.now();
  const d = new Date();
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute, 0);
  let secs = Math.round((target - now) / 1000);
  if (secs < -3600) secs += 86400;
  return secs;
}

function fmtDur(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h >= 1 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function renderRaffleCloseTime(s) {
  const box = el('raffle-close');
  if (!box) return;
  const show = !!s && !!s.closeTimeEnabled && s.phase === 'Betting';
  box.classList.toggle('hidden', !show);
  if (!show) { box.innerHTML = ''; return; }
  const hour = Number(s.closeHour) || 0;
  const minute = Number(s.closeMinute) || 0;
  const secs = raffleCloseSecs(hour, minute);
  const count = secs > 0 ? fmtDur(secs) : 'Closing...';
  box.classList.toggle('is-urgent', secs > 0 && secs <= 60);
  box.innerHTML = `<span class="raffle-close__icon" aria-hidden="true">&#9201;</span>`
    + `<span class="raffle-close__label">Registration closes ${pad2(hour)}:${pad2(minute)} ST</span>`
    + `<span class="raffle-close__count">${count}</span>`;
}

function raffleIsPot(prizeType) {
  return (prizeType || 'pot') === 'pot';
}

function rafflePrizeText(prizeType, prizeLabel, netPot, pot) {
  if (!raffleIsPot(prizeType)) return prizeLabel || 'Prize';
  return fmtGil(netPot || pot || 0);
}

function renderHeaderRaffle(s) {
  const host = s.hostName || 'Unknown host';
  el('host-line').textContent = `Hosted by ${host}${s.venueName ? ` · ${s.venueName}` : ''}`;
  setStatLabel('stat-round', 'Race');
  el('stat-round').textContent = s.raffleRaceNumber ?? '-';
  setStatLabel('stat-payout', raffleIsPot(s.prizeType) ? 'Pot' : 'Prize');
  el('stat-payout').textContent = rafflePrizeText(s.prizeType, s.prizeLabel, s.netPot, s.pot);
  const ew = el('stat-entry-wrap');
  if (s.entryFee) {
    el('stat-entry').textContent = fmtGil(s.entryFee);
    ew.classList.remove('hidden');
  } else {
    ew.classList.add('hidden');
  }
  setStatLabel('stat-track', 'Runners');
  el('stat-track').textContent = String((s.runners || []).length);
  el('stat-perfect-wrap').classList.add('hidden');

  const show = s.phase === 'Idle' || s.phase === 'Betting' || s.phase === 'BetsClosed';
  const ov = el('track-status');
  ov.classList.toggle('hidden', !show);
  if (show) {
    const label = s.phase === 'Betting' ? 'Registration Open' : s.phase === 'BetsClosed' ? 'Ready to Race' : 'Waiting';
    ov.querySelector('.track-status__text').textContent = label;
  }
}

function rafflePositionFor(n, s) {
  const finish = s.finishLine || 20;
  if (s.phase === 'Racing') return rafflePos.get(n) || 0;
  if (s.phase === 'Finished') {
    if (n === (s.winner || 0)) return finish;
    return rafflePos.has(n) ? rafflePos.get(n) : Math.max(0, finish - 3);
  }
  return 0;
}

function syncRaffleChocobos(s) {
  if (!s.finishLine) s.finishLine = 20;
  s.chocobos = (s.runners || []).map((r) => ({
    number: r.number, name: r.name, world: r.world, position: rafflePositionFor(r.number, s),
  }));
  s.winningChocobo = s.phase === 'Finished' ? (s.winner || 0) : 0;
}

function handleRafflePhase(s) {
  const phase = s.phase;
  if (raffleLastPhase !== 'Racing' && phase === 'Racing') {
    startCountdown();
    if (raffleStartTimer) clearTimeout(raffleStartTimer);
    raffleStartTimer = setTimeout(() => {
      if (currentState && isRaffle(currentState) && currentState.phase === 'Racing') startRaffleRace(currentState);
    }, RAFFLE_COUNTDOWN_MS);
  }
  if (phase !== 'Racing') stopRaffleRace();
  if (phase === 'Finished') finishRaffleRace(s);
  if (phase === 'Betting' || phase === 'BetsClosed' || phase === 'Idle') rafflePos.clear();
  raffleLastPhase = phase;
}

function startRaffleRace(s) {
  stopRaffleRaceTimer();
  rafflePlan = Array.isArray(s.racePlan) ? s.racePlan.slice() : [];
  const finish = s.finishLine || 20;
  raffleDurationMs = Math.max(5000, finish * RAFFLE_MS_PER_YALM);
  rafflePos.clear();
  (s.runners || []).forEach((r) => rafflePos.set(r.number, 0));
  raffleStartTs = (typeof performance !== 'undefined' ? performance : Date).now();
  raffleLastRender = 0;
  raffleRaf = requestAnimationFrame(raffleFrame);
}

function rafflePosAtT(points, t) {
  if (!Array.isArray(points) || points.length === 0) return 0;
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, p1] = points[i];
    if (t <= t1 || i === points.length - 1) {
      const [t0, p0] = points[i - 1];
      const span = Math.max(0.0001, t1 - t0);
      const frac = Math.max(0, Math.min(1, (t - t0) / span));
      return p0 + (p1 - p0) * frac;
    }
  }
  return points[points.length - 1][1];
}

function raffleFrame(now) {
  if (!currentState || !isRaffle(currentState) || currentState.phase !== 'Racing') { raffleRaf = 0; return; }
  const finish = currentState.finishLine || 20;
  const t = Math.max(0, Math.min(1, (now - raffleStartTs) / raffleDurationMs));
  if (now - raffleLastRender >= RAFFLE_RENDER_MS || t >= 1) {
    raffleLastRender = now;
    for (const p of rafflePlan) {
      const pos = Math.max(0, Math.min(finish, rafflePosAtT(p.points, t)));
      rafflePos.set(p.number, pos);
    }
    syncRaffleChocobos(currentState);
    renderHot(currentState);
  }
  raffleRaf = t < 1 ? requestAnimationFrame(raffleFrame) : 0;
}

function stopRaffleRaceTimer() {
  if (raffleRaf) { cancelAnimationFrame(raffleRaf); raffleRaf = 0; }
}

function stopRaffleRace() {
  stopRaffleRaceTimer();
  if (raffleStartTimer) { clearTimeout(raffleStartTimer); raffleStartTimer = null; }
}

function finishRaffleRace(s) {
  stopRaffleRace();
  const finish = s.finishLine || 20;
  if (s.winner) rafflePos.set(s.winner, finish);
  if (announcedWinner !== (s.winner || 0)) {
    announcedWinner = s.winner || 0;
    if (audio.playWin) audio.playWin();
  }
}

function renderRafflePodium(s) {
  const overlay = el('podium-overlay');
  if (s.phase !== 'Finished') { overlay.classList.add('hidden'); overlay.innerHTML = ''; return; }
  const w = (s.runners || []).find((r) => r.number === (s.winner || 0));
  if (!w) { overlay.classList.add('hidden'); return; }
  const color = raffleColor(w.number);
  overlay.innerHTML = `
    <div class="podium-overlay__card">
      <h3 class="podium-overlay__title">🏁 Raffle Winner</h3>
      <div class="raffle-podium">
        <span class="raffle-podium__silk" style="background:${color}">${w.number}</span>
        <span class="raffle-podium__name">${escapeHtml(w.name)}${w.world ? ` <small>(${escapeHtml(w.world)})</small>` : ''}</span>
      </div>
      <div class="raffle-podium__pot">${raffleIsPot(s.prizeType) ? 'Takes' : 'Prize:'} ${rafflePrizeText(s.prizeType, s.prizeLabel, s.netPot, s.pot)}</div>
    </div>`;
  overlay.classList.remove('hidden');
}

function renderRaffleRunners(s) {
  const runners = s.runners || [];
  el('raffle-runner-count').textContent = String(runners.length);
  if (runners.length === 0) {
    el('raffle-runners').innerHTML = '<div class="bets-empty">Waiting for runners to register...</div>';
    return;
  }
  const win = s.phase === 'Finished' ? (s.winner || 0) : 0;
  el('raffle-runners').innerHTML = runners.map((r) => {
    const color = raffleColor(r.number);
    const won = r.number === win;
    return `
      <div class="raffle-run ${won ? 'is-won' : ''}">
        <span class="raffle-run__silk" style="background:${color}">${r.number}</span>
        <span class="raffle-run__name">${escapeHtml(r.name)}${r.world ? `<small class="raffle-run__world">${escapeHtml(r.world)}</small>` : ''}</span>
        ${won ? '<span class="raffle-run__tag">WINNER</span>' : ''}
      </div>`;
  }).join('');
}

function renderLastResultsRaffle(results) {
  const box = el('last-results');
  if (!results || results.length === 0) { box.innerHTML = '<div class="bets-empty">No races yet</div>'; return; }
  box.innerHTML = results.map((r) => `
    <div class="result-item">
      <div class="result-item__head"><span class="result-item__round">Race ${r.round}</span></div>
      <div class="raffle-result">
        <span class="raffle-run__silk" style="background:${raffleColor(r.winner)}">${r.winner}</span>
        <span class="raffle-run__name">${escapeHtml(r.winnerName || `Runner ${r.winner}`)}${r.winnerWorld ? `<small class="raffle-run__world">${escapeHtml(r.winnerWorld)}</small>` : ''}</span>
        <span class="raffle-result__pot">${rafflePrizeText(r.prizeType, r.prizeLabel, r.netPot, r.pot)}</span>
      </div>
    </div>`).join('');
}

let houseTimer = null;
let serverOffsetMs = 0;

function renderHouseExtras(s) {
  if (!isHouse) return;
  if (s.serverNow) {
    const parsed = Date.parse(s.serverNow);
    if (!Number.isNaN(parsed)) serverOffsetMs = parsed - Date.now();
  }
  renderHouseCountdown(s);
  if (!houseTimer) {
    houseTimer = setInterval(() => { if (currentState) renderHouseCountdown(currentState); }, 1000);
  }
}

function renderHouseCountdown(s) {
  const wrap = el('stat-close-wrap');
  if (!wrap) return;
  const show = s.phase === 'Betting' && !!s.bettingClosesAt;
  wrap.classList.toggle('hidden', !show);
  if (!show) { wrap.classList.remove('is-urgent'); el('stat-close').textContent = '-'; return; }
  const secs = Math.max(0, Math.round((Date.parse(s.bettingClosesAt) - (Date.now() + serverOffsetMs)) / 1000));
  wrap.classList.toggle('is-urgent', secs > 0 && secs <= 30);
  el('stat-close').textContent = fmtDur(secs);
}

function applyCallCounts(data) {
  if (!currentState) return;
  const positions = data.positions || [];
  (currentState.chocobos || []).forEach((c, i) => { if (i < positions.length) c.position = positions[i]; });
  if (data.winningChocobo != null) currentState.winningChocobo = data.winningChocobo;
  if (data.phase) currentState.phase = data.phase;
  if (data.finishLine) currentState.finishLine = data.finishLine;
  if (currentState.phase === 'Racing' && !countdownActive && !finishPending) maybeKweh(currentState, 5);
  if (currentState.phase !== lastPhase) { renderAll(currentState); return; }
  renderHot(currentState);
}

function currentLeaderNum(s) {
  const order = [...(s.chocobos || [])].sort((a, b) => (b.position - a.position) || (a.number - b.number));
  return order.length ? order[0].number : 0;
}

function maybeKweh(s, interval) {
  rollCount += 1;
  const leader = currentLeaderNum(s);
  if (prevLeaderNum !== null && leader !== 0 && leader !== prevLeaderNum) {
    if (rollCount - lastKwehRoll >= interval) {
      audio.playKweh();
      lastKwehRoll = rollCount;
    }
  }
  prevLeaderNum = leader;
}

function startCountdown() {
  clearCountdown();
  countdownActive = true;
  finishPending = false;
  rollCount = 0;
  lastKwehRoll = -999;
  prevLeaderNum = null;
  announcedWinner = null;
  countdownColorIdx = 0;
  audio.restartTheme();
  audio.playHorn();

  const overlay = el('countdown');
  if (currentState) updateRunners(currentState);
  if (!overlay) { finishCountdown(); return; }
  overlay.classList.remove('hidden');

  const steps = ['3', '2', '1', 'Go!'];
  steps.forEach((label, i) => {
    countdownTimers.push(setTimeout(() => showCountdownStep(label, i === steps.length - 1), i * COUNT_STEP_MS));
  });
  countdownTimers.push(setTimeout(finishCountdown, (steps.length - 1) * COUNT_STEP_MS + GO_HOLD_MS));
}

function showCountdownStep(label, isGo) {
  const overlay = el('countdown');
  if (!overlay) return;
  const chars = [...label]
    .map((ch) => {
      const color = COUNTDOWN_COLORS[countdownColorIdx++ % COUNTDOWN_COLORS.length];
      const glyph = ch === ' ' ? '&nbsp;' : ch;
      return `<span class="countdown__char" style="color:${color}">${glyph}</span>`;
    })
    .join('');
  overlay.innerHTML = `<span class="countdown__num ${isGo ? 'is-go' : ''}">${chars}</span>`;
}

function finishCountdown() {
  countdownActive = false;
  const overlay = el('countdown');
  if (overlay) { overlay.classList.add('hidden'); overlay.innerHTML = ''; }
  if (currentState) renderAll(currentState);
}

function clearCountdown() {
  countdownTimers.forEach(clearTimeout);
  countdownTimers = [];
}

function beginFinish(winningChocobo) {
  if (announcedWinner === winningChocobo) return;
  announcedWinner = winningChocobo;
  currentState.winningChocobo = winningChocobo;
  currentState.phase = 'Finished';
  prevLeaderNum = null;
  const w = (currentState.chocobos || []).find((c) => c.number === winningChocobo);
  if (w && currentState.finishLine) w.position = currentState.finishLine;
  finishPending = true;
  renderAll(currentState);
  scheduleFinishReveal();
}

function scheduleFinishReveal() {
  if (finishTimer) clearTimeout(finishTimer);
  const winnerEl = el('track').querySelector(`.runner[data-runner="${currentState.winningChocobo}"]`);
  let done = false;
  const reveal = () => {
    if (done) return;
    done = true;
    if (winnerEl) winnerEl.removeEventListener('transitionend', onEnd);
    clearTimeout(finishTimer);
    finishPending = false;
    audio.playWin();
    if (currentState) renderAll(currentState);
  };
  function onEnd(e) { if (e.propertyName === 'transform') reveal(); }
  if (winnerEl) winnerEl.addEventListener('transitionend', onEnd);
  finishTimer = setTimeout(reveal, FINISH_REVEAL_MS);
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'state': renderAll(msg.data); if (token) refreshMe(); break;
    case 'call_counts': applyCallCounts(msg.data); break;
    case 'result':
      if (currentState) beginFinish(msg.data.winningChocobo);
      refreshMe();
      break;
    case 'session_ended':
      if (isHouse) { showHouseOffline(); } else { redirectEnded(msg.data && msg.data.reason); }
      break;
    default: break;
  }
}

function connect() {
  if (ended) return;
  ws = new WebSocket(raceSocketUrl(sessionId));
  ws.onopen = () => { reconnectDelay = 1000; };
  ws.onmessage = (ev) => { try { handleMessage(JSON.parse(ev.data)); } catch {} };
  ws.onerror = () => { try { ws.close(); } catch {} };
  ws.onclose = () => {
    if (ended) return;
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10000);
  };
}

const CHOCOBO_HOME = '/chocobo-racing/';

function redirectEnded(reason) {
  ended = true;
  try { ws && ws.close(); } catch {}
  window.location.replace(`${CHOCOBO_HOME}?ended=${encodeURIComponent(reason || 'ended')}`);
}

function showHouseOffline() {
  ended = true;
  try { ws && ws.close(); } catch {}
  hideLoader();
  el('race-view').classList.add('hidden');
  el('code-entry').classList.add('hidden');
  el('house-offline').classList.remove('hidden');
  const poll = setInterval(async () => {
    try {
      const res = await getState(sessionId);
      if (res.ok) { clearInterval(poll); window.location.reload(); }
    } catch {}
  }, 15000);
}

function probeSpriteSheet() {
  const img = new Image();
  img.onload = () => el('track').classList.add('sheet-ready');
  img.src = SPRITE_SHEET;
}

function probeBackdrop() {
  const img = new Image();
  img.onload = () => {
    const tile = Math.max(200, Math.round(112 * (img.naturalWidth / img.naturalHeight)));
    el('track').style.setProperty('--sky-tile', `${tile}px`);
  };
  img.src = '/game-assets/chocobo-racing/night-background.jpg';
}

function showCodeEntry(message) {
  hideLoader();
  el('code-entry').classList.remove('hidden');
  el('race-view').classList.add('hidden');
  if (message) {
    const p = document.createElement('p');
    p.className = 'slip-msg err';
    p.textContent = message;
    el('code-entry').appendChild(p);
  }
  el('code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = el('code-input').value.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (code) window.location.assign(`${RACE_PREFIX}?s=${encodeURIComponent(code)}`);
  });
}

function digitsOnly(input, max) {
  input.addEventListener('input', () => {
    const cleaned = input.value.replace(/\D/g, '').slice(0, max);
    if (cleaned !== input.value) input.value = cleaned;
  });
}

function wireUi() {
  el('open-join').addEventListener('click', openModal);
  el('pin-close').addEventListener('click', closeModal);
  el('pin-modal').addEventListener('click', (e) => { if (e.target === el('pin-modal')) closeModal(); });
  el('pin-form').addEventListener('submit', submitPin);
  digitsOnly(el('pin-input'), 6);

  if (isHouse) {
    el('open-join').textContent = 'Log in to bet';
    el('slip-login-hint').textContent = 'Log in with your OOF account to place bets.';
  }

  el('pin-changed-close').addEventListener('click', closePinChanged);
  el('pin-changed-modal').addEventListener('click', (e) => { if (e.target === el('pin-changed-modal')) closePinChanged(); });

  el('open-howto').addEventListener('click', openHowTo);
  el('howto-close').addEventListener('click', closeHowTo);

  el('runner-list').addEventListener('click', (e) => {
    const row = e.target.closest('.runner-row');
    if (row) toggleSelect(parseInt(row.dataset.num, 10));
  });

  el('slip-lines').addEventListener('input', (e) => {
    const stakeEl = e.target.closest('[data-stake]');
    if (!stakeEl) return;
    const n = parseInt(stakeEl.dataset.stake, 10);
    let raw = digitsOf(stakeEl.value);
    const cap = betCapFor(n);
    if (raw && cap !== Infinity && parseInt(raw, 10) > cap) raw = String(cap);
    stakeEl.value = groupGil(raw);
    selection.set(n, raw);
    const ret = raw ? Math.floor(parseInt(raw, 10) * oddsValue()) : 0;
    stakeEl.closest('.slip-line').querySelector('.slip-line__ret').textContent = ret ? `returns ${fmtGil(ret)}` : '';
    updateSlipState();
  });
  el('slip-lines').addEventListener('click', (e) => {
    const step = e.target.closest('.stepper__btn');
    if (step) {
      const input = step.closest('.slip-line').querySelector('[data-stake]');
      stepStake(input, parseInt(step.dataset.dir, 10) * 1000);
      return;
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) toggleSelect(parseInt(rm.dataset.rm, 10));
  });

  const stakeAll = el('stake-all');
  stakeAll.addEventListener('input', () => {
    const raw = digitsOf(stakeAll.value);
    stakeAll.value = groupGil(raw);
    const val = parseInt(raw, 10) || 0;
    for (const n of selection.keys()) selection.set(n, raw === '' ? '' : String(Math.min(val, betCapFor(n))));
    renderSlip();
  });
  stakeAll.closest('.stepper').addEventListener('click', (e) => {
    const step = e.target.closest('.stepper__btn');
    if (!step) return;
    const next = Math.max(0, (parseInt(digitsOf(stakeAll.value), 10) || 0) + parseInt(step.dataset.dir, 10) * 1000);
    stakeAll.value = groupGil(String(next));
    for (const n of selection.keys()) selection.set(n, String(Math.min(next, betCapFor(n))));
    renderSlip();
  });

  el('max-bet').addEventListener('click', maxBet);
  el('place-bet').addEventListener('click', placeBets);
}

async function init() {
  if (!sessionId) { showCodeEntry(); return; }
  if (isHouse) document.body.classList.add('is-house');
  el('race-view').classList.remove('hidden');
  audio.init();
  wireUi();
  renderPlayer();
  probeSpriteSheet();
  probeBackdrop();

  const res = await getState(sessionId);
  if (!res.ok) {
    if (isHouse) { showHouseOffline(); return; }
    if (res.status === 404) { redirectEnded('notfound'); return; }
    el('race-view').classList.add('hidden');
    showCodeEntry('Could not load the race. Try again shortly.');
    return;
  }
  renderAll(res.data);
  if (isHouse || token) await refreshMe();
  openHowTo();
  connect();
  chatPanel = mountChat({
    ...chatBases(),
    game: 'race',
    roomKey: sessionId,
    title: 'Race Chat',
    startOpen: false,
    getAuthToken: () => (token && token !== 'house' ? token : null),
  });
  watchModals();
}

init();
