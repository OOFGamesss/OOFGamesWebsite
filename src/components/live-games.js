import { liveSessions } from '../api/chocobo-racing-client.js';
import { enableCardHover } from '../utils/card-hover.js';

const POLL_MS = 15000;
const RACE_BASE = '/chocobo-racing/race/';

const PHASES = {
  Betting: { label: 'Betting open', tone: 'green', pulse: true },
  BetsClosed: { label: 'Bets closed', tone: 'gold', pulse: false },
  Racing: { label: 'Racing now', tone: 'red', pulse: true },
  Finished: { label: 'Race finished', tone: 'violet', pulse: false },
  Idle: { label: 'Lobby open', tone: 'violet', pulse: false },
};

const TONES = {
  green: 'bg-neon-green/15 text-neon-green',
  gold: 'bg-neon-gold/15 text-neon-gold',
  red: 'bg-red-500/15 text-red-400',
  violet: 'bg-neon-violet/20 text-slate-300',
};

const grid = document.querySelector('[data-live-grid]');
const hostRegion = document.querySelector('[data-live-hosts]');

let lastPayload = '';
let clockSkewMs = 0;
let houseClosesAt = 0;
let houseParts = [];

const gil = (n) => `${Number(n || 0).toLocaleString('en-GB')} gil`;

function phasePill(phase) {
  const meta = PHASES[phase] || PHASES.Idle;
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

function venueImage(url, alt) {
  const img = document.createElement('img');
  img.className = 'mx-auto h-28 w-28 rounded-xl object-cover';
  img.alt = alt;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.style.filter = 'drop-shadow(0 0 10px rgba(139, 92, 255, 0.6))';

  const fallback = () => {
    img.src = '/images/chocoboracing.png';
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

function grandNationalStats(session) {
  const prize = session.prizeType === 'pot' ? gil(session.netPot || session.pot) : session.prizeLabel;
  const runners = `${session.runnerCount} ${session.runnerCount === 1 ? 'runner' : 'runners'}`;
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
  const card = document.createElement('a');
  card.href = `${RACE_BASE}?s=${encodeURIComponent(session.sessionId)}`;
  card.className = 'panel group flex flex-col gap-3 p-6 transition-transform duration-150';
  card.setAttribute('data-plugin-card', '');

  const title = document.createElement('h4');
  title.className = 'text-center text-xl font-semibold text-neon-gold';
  title.textContent = session.venueName || session.hostName || 'Chocobo Racing';

  const status = document.createElement('div');
  status.className = 'flex justify-center';
  status.appendChild(phasePill(session.phase));

  const stats = document.createElement('p');
  stats.className = 'text-center text-sm text-slate-300';
  stats.textContent = session.mode === 'grand_national' ? grandNationalStats(session) : classicStats(session);

  const cta = document.createElement('span');
  cta.className = 'mt-auto text-center text-sm font-semibold text-neon-cyan group-hover:underline';
  cta.textContent = 'Watch Live ➔';

  card.append(venueImage(session.venueImageUrl, `${title.textContent} venue image`), title, status, stats, cta);
  return card;
}

function renderHosts(sessions) {
  hostRegion.textContent = '';
  sessions.forEach((s) => hostRegion.appendChild(hostCard(s)));
  enableCardHover(hostRegion);
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
    status.appendChild(phasePill('Idle'));
    paintHouseStats();
    return;
  }

  status.textContent = '';
  status.appendChild(phasePill(house.phase));

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

async function poll() {
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

if (grid && hostRegion) {
  poll();
  setInterval(() => {
    if (!document.hidden) {
      poll();
    }
  }, POLL_MS);
  setInterval(paintHouseStats, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      poll();
    }
  });
}
