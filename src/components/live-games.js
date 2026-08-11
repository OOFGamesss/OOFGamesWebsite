import { liveSessions } from '../api/chocobo-racing-client.js';
import { liveSessions as drtLiveSessions } from '../api/minigames-emporium-client.js';
import { lotteryClient } from '../api/lottery-client.js';
import { enableCardHover } from '../utils/card-hover.js';

const POLL_MS = 15000;
const RACE_BASE = '/chocobo-racing/race/';
const DRT_BASE = '/mini-games-emporium/drt/bracket/';
const RACE_FALLBACK_IMAGE = '/images/chocoboracing.png';
const DRT_FALLBACK_IMAGE = '/images/minigamesemporium.png';

const PHASES = {
  Betting: { label: 'Betting Open', tone: 'green', pulse: true },
  BetsClosed: { label: 'Bets closed', tone: 'gold', pulse: false },
  Racing: { label: 'Racing now', tone: 'red', pulse: true },
  Finished: { label: 'Race finished', tone: 'violet', pulse: false },
  Idle: { label: 'Lobby open', tone: 'violet', pulse: false },
};

const DRT_PHASES = {
  registration: { label: 'Sign-ups open', tone: 'green', pulse: true },
  tournament: { label: 'Tournament live', tone: 'red', pulse: true },
  complete: { label: 'Tournament finished', tone: 'violet', pulse: false },
};

const DRT_CTA = {
  registration: 'Join & Watch ➔',
  tournament: 'Watch Live ➔',
  complete: 'View Results ➔',
};

const TONES = {
  green: 'bg-neon-green/15 text-neon-green',
  gold: 'bg-neon-gold/15 text-neon-gold',
  red: 'bg-red-500/15 text-red-400',
  violet: 'bg-neon-violet/20 text-slate-300',
};

const grid = document.querySelector('[data-live-grid]');
const hostRegion = document.querySelector('[data-live-hosts]');
const drtSection = document.querySelector('[data-drt-section]');
const drtRegion = document.querySelector('[data-drt-hosts]');

let lastPayload = '';
let lastDrtPayload = '';
let clockSkewMs = 0;
let houseClosesAt = 0;
let houseParts = [];
let lotteryDrawAt = 0;
let lotterySalesOpen = false;
let lotteryPillText = null;

const gil = (n) => `${Number(n || 0).toLocaleString('en-GB')} gil`;
const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;
const parseUtcMs = (value) =>
  value ? Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`) : 0;

function phasePill(meta) {
  const pill = document.createElement('span');
  pill.className = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[meta.tone]}`;

  const dot = document.createElement('span');
  dot.className = 'relative flex h-1.5 w-1.5';
  if (meta.pulse) {
    const ping = document.createElement('span');
    ping.className = 'absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75';
    dot.appendChild(ping);
  }
  const core = document.createElement('span');
  core.className = 'relative inline-flex h-1.5 w-1.5 rounded-full bg-current';
  dot.appendChild(core);

  pill.append(dot, document.createTextNode(meta.label));
  return pill;
}

const racePill = (phase) => phasePill(PHASES[phase] || PHASES.Idle);
const drtPill = (phase) => phasePill(DRT_PHASES[phase] || DRT_PHASES.registration);

function venueImage(url, alt, fallbackSrc) {
  const img = document.createElement('img');
  img.className = 'mx-auto h-28 w-28 rounded-xl object-cover';
  img.alt = alt;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.style.filter = 'drop-shadow(0 0 10px rgba(139, 92, 255, 0.6))';

  const fallback = () => {
    img.src = fallbackSrc;
    img.classList.add('object-contain');
    img.classList.remove('object-cover');
  };
  img.addEventListener('error', fallback, { once: true });

  if (typeof url === 'string' && url.startsWith('https://')) {
    img.src = url;
  } else {
    fallback();
  }
  return img;
}

function buildCard({ href, title, pill, stats, cta, image }) {
  const card = document.createElement('a');
  card.href = href;
  card.className = 'panel group flex flex-col gap-3 p-6 transition-transform duration-150';
  card.setAttribute('data-plugin-card', '');

  const heading = document.createElement('h4');
  heading.className = 'text-center text-xl font-semibold text-neon-gold';
  heading.textContent = title;

  const status = document.createElement('div');
  status.className = 'flex justify-center';
  status.appendChild(pill);

  const statLine = document.createElement('p');
  statLine.className = 'text-center text-sm text-slate-300';
  statLine.textContent = stats;

  const action = document.createElement('span');
  action.className = 'mt-auto text-center text-sm font-semibold text-neon-cyan group-hover:underline';
  action.textContent = cta;

  card.append(image, heading, status, statLine, action);
  return card;
}

function raffleStats(session) {
  const prize = session.prizeType === 'pot' ? gil(session.netPot || session.pot) : session.prizeLabel;
  const runners = plural(session.runnerCount, 'runner');
  return prize ? `${prize} · ${runners}` : runners;
}

function classicStats(session) {
  const parts = [];
  if (session.chocoboCount > 0) {
    parts.push(`${session.chocoboCount} chocobos`);
  }
  if (session.odds > 0) {
    parts.push(`${session.odds}x odds`);
  }
  if (session.finishLine > 0) {
    parts.push(`${session.finishLine} yalms`);
  }
  return parts.join(' · ');
}

function hostCard(session) {
  const title = session.venueName || session.hostName || 'Chocobo Racing';
  return buildCard({
    href: `${RACE_BASE}?s=${encodeURIComponent(session.sessionId)}`,
    title,
    pill: racePill(session.phase),
    stats: session.mode === 'grand_national' ? raffleStats(session) : classicStats(session),
    cta: 'Watch Live ➔',
    image: venueImage(session.venueImageUrl, `${title} venue image`, RACE_FALLBACK_IMAGE),
  });
}

function drtStats(session) {
  const players = plural(session.playerCount, 'player');
  if (session.phase === 'complete') {
    return session.winnerName ? `Winner: ${session.winnerName}` : `Finished · ${players}`;
  }
  if (session.phase === 'tournament') {
    return session.totalRounds > 0
      ? `Round ${session.currentRound} of ${session.totalRounds} · ${players}`
      : players;
  }
  return session.entryCost > 0 ? `${players} · ${gil(session.entryCost)} entry` : players;
}

function drtCard(session) {
  const title = session.venueName || session.hostName || 'Deathroll Tournament';
  return buildCard({
    href: `${DRT_BASE}?s=${encodeURIComponent(session.sessionId)}`,
    title,
    pill: drtPill(session.phase),
    stats: drtStats(session),
    cta: DRT_CTA[session.phase] || DRT_CTA.tournament,
    image: venueImage(session.venueImageUrl, `${title} venue image`, DRT_FALLBACK_IMAGE),
  });
}

function renderHosts(sessions) {
  hostRegion.textContent = '';
  sessions.forEach((s) => hostRegion.appendChild(hostCard(s)));
  enableCardHover(hostRegion);
}

function renderDrt(sessions) {
  drtSection.classList.toggle('hidden', sessions.length === 0);
  drtRegion.textContent = '';
  sessions.forEach((s) => drtRegion.appendChild(drtCard(s)));
  enableCardHover(drtRegion);
}

function renderHouse(house) {
  const status = document.querySelector('[data-house-status]');
  if (!status) {
    return;
  }
  if (!house) {
    houseClosesAt = 0;
    houseParts = [];
    status.textContent = '';
    status.appendChild(racePill('Idle'));
    paintHouseStats();
    return;
  }

  status.textContent = '';
  status.appendChild(racePill(house.phase));

  const closesAt = house.bettingClosesAt ? Date.parse(house.bettingClosesAt) : 0;
  const serverNow = house.serverNow ? Date.parse(house.serverNow) : 0;
  clockSkewMs = serverNow ? Date.now() - serverNow : 0;
  houseClosesAt = house.phase === 'Betting' && closesAt ? closesAt : 0;

  const stats = classicStats(house);
  houseParts = stats ? [stats] : [];
  paintHouseStats();
}

function paintHouseStats() {
  const el = document.querySelector('[data-house-stats]');
  if (!el) {
    return;
  }
  const parts = [...houseParts];
  if (houseClosesAt) {
    const remaining = Math.max(0, Math.round((houseClosesAt - (Date.now() - clockSkewMs)) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = String(remaining % 60).padStart(2, '0');
    parts.push(remaining > 0 ? `closes ${mins}:${secs}` : 'closing…');
  }
  el.textContent = parts.length ? parts.join(' · ') : 'Runs 24/7';
}

async function pollRaces() {
  const result = await liveSessions();
  if (!result.ok || !result.data) {
    return;
  }
  renderHouse(result.data.house);

  const sessions = result.data.sessions || [];
  const fingerprint = JSON.stringify(sessions);
  if (fingerprint === lastPayload) {
    return;
  }
  lastPayload = fingerprint;
  renderHosts(sessions);
}

function renderLottery(current) {
  const el = document.querySelector('[data-lottery-stats]');
  if (!el || !current) {
    return;
  }
  const tickets = plural(Number(current.ticket_count || 0), 'ticket');
  el.textContent = `${gil(current.pot)} jackpot pool · ${tickets} sold`;

  lotteryDrawAt = parseUtcMs(current.scheduled_at);
  lotterySalesOpen = Boolean(current.sales_open);
  renderLotteryPill();
}

function renderLotteryPill() {
  const status = document.querySelector('[data-lottery-status]');
  if (!status) {
    return;
  }
  status.textContent = '';
  lotteryPillText = null;
  if (!lotteryDrawAt) {
    return;
  }
  const pill = lotterySalesOpen
    ? phasePill({ label: 'Ticket Sales Open', tone: 'green', pulse: true })
    : phasePill({ label: 'Drawing soon', tone: 'gold', pulse: false });
  if (lotterySalesOpen) {
    lotteryPillText = document.createTextNode('');
    pill.appendChild(lotteryPillText);
  }
  status.appendChild(pill);
  paintLotteryCountdown();
}

function paintLotteryCountdown() {
  if (!lotteryPillText || !lotteryDrawAt) {
    return;
  }
  const remaining = lotteryDrawAt - Date.now();
  if (remaining <= 0) {
    lotteryPillText.data = ' · drawing…';
    return;
  }
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  lotteryPillText.data = days > 0 ? ` · ${days}d ${hours}h ${mins}m` : ` · ${hours}h ${mins}m ${secs}s`;
}

async function pollLottery() {
  const el = document.querySelector('[data-lottery-stats]');
  if (!el) {
    return;
  }
  const result = await lotteryClient.getCurrent();
  if (!result.ok || !result.data) {
    return;
  }
  renderLottery(result.data);
}

async function pollDrt() {
  if (!drtSection || !drtRegion) {
    return;
  }
  const result = await drtLiveSessions();
  if (!result.ok || !result.data) {
    return;
  }
  const sessions = result.data.sessions || [];
  const fingerprint = JSON.stringify(sessions);
  if (fingerprint === lastDrtPayload) {
    return;
  }
  lastDrtPayload = fingerprint;
  renderDrt(sessions);
}

function poll() {
  pollRaces();
  pollLottery();
  pollDrt();
}

if (grid && hostRegion) {
  poll();
  setInterval(() => {
    if (!document.hidden) {
      poll();
    }
  }, POLL_MS);
  setInterval(() => {
    paintHouseStats();
    paintLotteryCountdown();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      poll();
    }
  });
}
