import { getState, submitJoin, joinStatus, drtSocketUrl } from '/api/minigames-emporium-client.js';

const BRACKET_PREFIX = '/mini-games-emporium/drt/bracket/';
const DRT_HOME = '/mini-games-emporium/drt/';
const JOIN_POLL_MS = 5000;
const IMAGE_URL = /^https?:\/\/[^\s"'()\\]+\.(jpe?g|png|webp)(\?[^\s"'()\\]*)?$/i;

function getSessionId() {
  const fromQuery = new URLSearchParams(window.location.search).get('s');
  if (fromQuery) return fromQuery;
  const path = window.location.pathname;
  if (path.startsWith(BRACKET_PREFIX)) {
    const rest = path.slice(BRACKET_PREFIX.length).replace(/\/+$/, '');
    if (rest) return decodeURIComponent(rest);
  }
  return null;
}

const sessionId = getSessionId();

const el = (id) => document.getElementById(id);
const show = (id, visible) => el(id).classList.toggle('hidden', !visible);

let ws = null;
let ended = false;
let reconnectDelay = 1000;
let joinPollTimer = null;
let joinSubmitted = false;
let linesFrame = 0;

function gil(n) {
  return `${Number(n || 0).toLocaleString('en-GB')} gil`;
}

function phaseLabel(phase) {
  switch (phase) {
    case 'registration': return 'Registration';
    case 'tournament': return 'In Progress';
    case 'complete': return 'Complete';
    case 'idle': return 'Waiting';
    default: return phase || '-';
  }
}

function matchPhaseText(activeMatch) {
  switch (activeMatch.phase) {
    case 'determiningorder':
      return 'Rolling /random 10 to decide who goes first…';
    case 'deathrolling':
      return activeMatch.turnPlayer
        ? `${escapeHtml(activeMatch.turnPlayer)} to roll /random ${Number(activeMatch.rollMax || 0).toLocaleString('en-GB')}`
        : 'Deathrolling…';
    case 'gameover':
      return 'Game over - next game starting soon…';
    case 'matchcomplete':
      return 'Match complete!';
    default:
      return 'Waiting for the match to start…';
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function sanitizeImageUrl(url) {
  const v = String(url || '').trim();
  return IMAGE_URL.test(v) ? v : '';
}

function setConn(live) {
  const dot = el('conn-dot');
  dot.classList.toggle('is-live', live);
  dot.classList.toggle('is-down', !live);
}

function renderHeader(s) {
  const host = s.hostName || '';
  const venue = s.venueName || '';
  const line = host && venue ? `Hosted by ${host} · ${venue}` : host ? `Hosted by ${host}` : 'Live bracket';
  el('host-line').textContent = line;

  el('stat-phase').textContent = phaseLabel(s.phase);
  el('stat-players').textContent = (s.players || []).length || '-';

  const entry = Number(s.entryCost || 0);
  show('stat-entry-wrap', entry > 0);
  if (entry > 0) el('stat-entry').textContent = entry.toLocaleString('en-GB');

  const prize = s.prize;
  el('stat-prize').textContent = prize && prize.label ? prize.label : '-';
}

function renderVenue(s) {
  const url = sanitizeImageUrl(s.venueImageUrl);
  const panel = el('bracket-panel');
  if (url) {
    panel.style.setProperty('--venue-img', `url("${url}")`);
    panel.classList.add('has-venue');
  } else {
    panel.style.removeProperty('--venue-img');
    panel.classList.remove('has-venue');
  }
}

function renderPlayers(s) {
  const players = s.players || [];
  const isRegistration = s.phase === 'registration';
  show('registration-panel', isRegistration);
  if (!isRegistration) return;
  const paid = players.filter((p) => p.paid).length;
  el('reg-count').textContent = `${paid} / ${players.length} paid`;
  el('player-list').innerHTML = players
    .map((p) => {
      const tags = [];
      if (p.unlinked) tags.push('<span class="tag tag--unlinked">Unlinked</span>');
      tags.push(p.paid ? '<span class="tag tag--paid">Paid</span>' : '<span class="tag tag--unpaid">Unpaid</span>');
      return `<li><span>${escapeHtml(p.name)}</span><span>${tags.join(' ')}</span></li>`;
    })
    .join('');
}

function currentMatch(s) {
  const b = s.bracket;
  if (!b || !b.rounds || !b.rounds.length) return null;
  const round = b.rounds[b.currentRoundIndex];
  if (!round) return null;
  return round[b.currentMatchIndex] || null;
}

function renderActiveMatch(s) {
  const active = s.phase === 'tournament' ? s.activeMatch : null;
  const m = currentMatch(s);
  show('active-match-panel', Boolean(active && m));
  if (!active || !m) return;

  const p1 = m.p1Bye ? 'BYE' : m.p1 || 'TBD';
  const p2 = m.p2Bye ? 'BYE' : m.p2 || 'TBD';
  const bestOf = (s.bracket.bestOfPerRound || [])[s.bracket.currentRoundIndex];
  el('match-vs').textContent = `${p1} vs ${p2}`;
  el('match-score').textContent = bestOf
    ? `${active.p1Wins}-${active.p2Wins} · Best of ${bestOf}`
    : `${active.p1Wins}-${active.p2Wins}`;
  el('match-status').innerHTML = matchPhaseText(active);

  const rolls = (active.rollLog || []).slice().reverse();
  el('roll-log').innerHTML = rolls.length
    ? rolls
        .map((r) => {
          const value = Number(r.value);
          const death = value === 1;
          const dead = death ? '<span class="roll-dead">DEAD!</span>' : '';
          return `<li${death ? ' class="is-death"' : ''}>`
            + `<span class="roll-player">${escapeHtml(r.player)}</span>`
            + `<span class="roll-detail">/random ${Number(r.max).toLocaleString('en-GB')}`
            + ` → <span class="roll-value">${value.toLocaleString('en-GB')}</span>${dead}</span>`
            + '</li>';
        })
        .join('')
    : '<li class="roll-empty">No rolls yet.</li>';
}

function roundTitle(index, total) {
  if (index === total - 1) return 'Final';
  if (index === total - 2) return 'Semi-finals';
  return `Round ${index + 1}`;
}

function slotHtml(m, which) {
  const bye = which === 1 ? m.p1Bye : m.p2Bye;
  const name = which === 1 ? m.p1 : m.p2;
  const wins = which === 1 ? m.p1Wins : m.p2Wins;
  const classes = ['bracket__slot'];
  let label = name || 'TBD';
  if (bye) {
    classes.push('is-bye');
    label = 'BYE';
  } else if (m.resolved && m.winner) {
    classes.push(m.winner === name ? 'is-winner' : 'is-loser');
  }
  const search = bye || !name ? '' : ` data-player="${escapeHtml(name)}"`;
  return `<div class="${classes.join(' ')}"${search}><span>${escapeHtml(label)}</span><span class="bracket__score">${Number(wins || 0)}</span></div>`;
}

function renderBracket(s) {
  const b = s.bracket;
  const hasBracket = Boolean(b && b.rounds && b.rounds.length);
  show('bracket-panel', hasBracket);
  if (!hasBracket) return;

  const total = b.rounds.length;
  el('bracket').innerHTML = b.rounds
    .map((round, ri) => {
      const matches = round
        .map((m, mi) => {
          const isCurrent = s.phase === 'tournament' && ri === b.currentRoundIndex && mi === b.currentMatchIndex;
          const classes = ['bracket__match'];
          if (isCurrent) classes.push('is-current');
          if (m.resolved) classes.push('is-resolved');
          return `<div class="${classes.join(' ')}">${slotHtml(m, 1)}${slotHtml(m, 2)}</div>`;
        })
        .join('');
      return `<div class="bracket__round"><p class="bracket__round-title">${roundTitle(ri, total)}</p>`
        + `<div class="bracket__matches">${matches}</div></div>`;
    })
    .join('');
  applyBracketSearch(false);
  scheduleBracketLines();
}

function drawBracketLines() {
  const canvas = el('bracket-canvas');
  const svg = el('bracket-lines');
  const rounds = [...el('bracket').querySelectorAll('.bracket__round')];
  const base = canvas.getBoundingClientRect();
  const rel = (node) => {
    const r = node.getBoundingClientRect();
    return { left: r.left - base.left, right: r.right - base.left, cy: r.top - base.top + r.height / 2 };
  };

  const segments = [];
  for (let r = 0; r < rounds.length - 1; r += 1) {
    const src = [...rounds[r].querySelectorAll('.bracket__match')];
    const dst = [...rounds[r + 1].querySelectorAll('.bracket__match')];
    dst.forEach((target, i) => {
      const a = src[2 * i];
      const b = src[2 * i + 1];
      if (!a || !b) return;
      const aR = rel(a);
      const bR = rel(b);
      const tR = rel(target);
      const midX = (aR.right + tR.left) / 2;
      segments.push(`M${aR.right} ${aR.cy} H${midX} V${tR.cy} H${tR.left}`);
      segments.push(`M${bR.right} ${bR.cy} H${midX} V${tR.cy}`);
    });
  }

  const w = Math.ceil(canvas.scrollWidth);
  const h = Math.ceil(canvas.scrollHeight);
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = segments.length ? `<path d="${segments.join(' ')}" />` : '';
}

function scheduleBracketLines() {
  cancelAnimationFrame(linesFrame);
  linesFrame = requestAnimationFrame(drawBracketLines);
}

function applyBracketSearch(scrollToFirst) {
  const input = el('bracket-search');
  const query = (input.value || '').trim().toLowerCase();
  const slots = [...document.querySelectorAll('#bracket .bracket__slot')];
  slots.forEach((slot) => slot.classList.remove('is-found'));

  if (!query) {
    input.classList.remove('is-empty');
    return;
  }

  const roundIndex = new Map(
    [...el('bracket').querySelectorAll('.bracket__round')].map((round, i) => [round, i]),
  );
  const furthest = new Map();
  slots.forEach((slot) => {
    const name = slot.dataset.player || '';
    if (!name || !name.toLowerCase().includes(query)) return;
    const round = roundIndex.get(slot.closest('.bracket__round')) ?? 0;
    const best = furthest.get(name);
    if (!best || round > best.round) furthest.set(name, { slot, round });
  });

  input.classList.toggle('is-empty', furthest.size === 0);

  let target = null;
  let targetRound = -1;
  furthest.forEach(({ slot, round }) => {
    slot.classList.add('is-found');
    if (round > targetRound) {
      target = slot;
      targetRound = round;
    }
  });
  if (scrollToFirst && target) centreInViewport(target);
}

function centreInViewport(slot) {
  const viewport = el('bracket-viewport');
  const v = viewport.getBoundingClientRect();
  const s = slot.getBoundingClientRect();
  viewport.scrollBy({
    left: (s.left + s.width / 2) - (v.left + v.width / 2),
    top: (s.top + s.height / 2) - (v.top + v.height / 2),
    behavior: 'smooth',
  });
}

function enableBracketDrag() {
  const viewport = el('bracket-viewport');
  let down = false;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let fromLeft = 0;
  let fromTop = 0;

  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    down = true;
    dragging = false;
    startX = event.clientX;
    startY = event.clientY;
    fromLeft = viewport.scrollLeft;
    fromTop = viewport.scrollTop;
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!down) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragging) {
      if (Math.hypot(dx, dy) < 4) return;
      dragging = true;
      viewport.classList.add('is-dragging');
      try { viewport.setPointerCapture(event.pointerId); } catch {}
    }
    viewport.scrollLeft = fromLeft - dx;
    viewport.scrollTop = fromTop - dy;
    event.preventDefault();
  });

  const release = (event) => {
    if (!down) return;
    down = false;
    dragging = false;
    viewport.classList.remove('is-dragging');
    try { viewport.releasePointerCapture(event.pointerId); } catch {}
  };
  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', release);
}

function renderWinner(s) {
  const won = s.phase === 'complete' && s.winner && s.winner.name;
  show('winner-panel', Boolean(won));
  if (!won) return;
  el('winner-name').textContent = s.winner.name;
  const prize = s.prize;
  el('winner-payout').textContent = prize && prize.type === 'gil'
    ? `Wins ${gil(prize.gilAmount || s.pot)}`
    : prize && prize.label
      ? `Wins ${prize.label}`
      : '';
}

function renderBets(s) {
  const betting = s.betting;
  const enabled = Boolean(betting && betting.enabled);
  show('bets-panel', enabled);
  if (!enabled) return;

  const bets = betting.confirmedBets || [];
  el('bets-hint').textContent = `${bets.length} bet${bets.length === 1 ? '' : 's'} · ${gil(betting.betUnit)} each · pot ${gil(betting.pot)}`;
  el('bets-list').innerHTML = bets.length
    ? bets
        .map((b) => `<li><span>${escapeHtml(b.bettor)}</span><span>on <span class="bet-target">${escapeHtml(b.target)}</span></span></li>`)
        .join('')
    : '<li><span>No bets placed yet.</span></li>';

  const payouts = betting.payouts || [];
  show('payouts-wrap', payouts.length > 0);
  if (payouts.length) {
    el('payouts-list').innerHTML = payouts
      .map((p) => `<li><span>${escapeHtml(p.bettor)}</span><span class="text-gold">${gil(p.share)}</span></li>`)
      .join('');
  }
}

function renderJoinPanel(s) {
  const isRegistration = s.phase === 'registration';
  show('join-panel', isRegistration);
  if (isRegistration) refreshJoinStatus();
  else stopJoinPolling();
}

function renderAll(s) {
  show('idle-panel', s.phase === 'idle');
  show('drt-view', s.phase !== 'idle');
  renderHeader(s);
  renderVenue(s);
  renderJoinPanel(s);
  renderPlayers(s);
  renderActiveMatch(s);
  renderBracket(s);
  renderWinner(s);
  renderBets(s);
}

function setJoinStatus(text, kind) {
  const node = el('join-status');
  node.textContent = text;
  node.className = `join-status${kind ? ` is-${kind}` : ''}`;
  node.classList.remove('hidden');
}

async function refreshJoinStatus() {
  const { ok, data } = await joinStatus(sessionId);
  if (!ok) return;
  applyJoinStatus(data.status);
}

function applyJoinStatus(status) {
  const form = el('join-form');
  switch (status) {
    case 'queued':
      joinSubmitted = true;
      form.classList.add('hidden');
      setJoinStatus('Request sent! Waiting for the host to accept…', 'queued');
      startJoinPolling();
      break;
    case 'accepted':
      joinSubmitted = true;
      form.classList.add('hidden');
      setJoinStatus('You are in! Find the host in-game to link your character and pay any entry cost.', 'accepted');
      stopJoinPolling();
      break;
    case 'rejected':
      form.classList.remove('hidden');
      setJoinStatus('The host declined your request. You can submit a different name.', 'rejected');
      stopJoinPolling();
      break;
    default:
      if (!joinSubmitted) {
        form.classList.remove('hidden');
        el('join-status').classList.add('hidden');
      }
      stopJoinPolling();
      break;
  }
}

function startJoinPolling() {
  if (joinPollTimer) return;
  joinPollTimer = setInterval(refreshJoinStatus, JOIN_POLL_MS);
}

function stopJoinPolling() {
  if (!joinPollTimer) return;
  clearInterval(joinPollTimer);
  joinPollTimer = null;
}

async function handleJoinSubmit(event) {
  event.preventDefault();
  const name = el('join-name').value.trim();
  if (!name) return;
  const { ok, status, error } = await submitJoin(sessionId, name);
  if (ok) {
    applyJoinStatus('queued');
    return;
  }
  if (status === 409) {
    setJoinStatus(error || 'You have already submitted a name for this session.', 'error');
    refreshJoinStatus();
    return;
  }
  setJoinStatus(error || 'Could not send the request. Please try again.', 'error');
}

function redirectEnded(reason) {
  ended = true;
  stopJoinPolling();
  try { ws && ws.close(); } catch {}
  window.location.replace(`${DRT_HOME}?ended=${encodeURIComponent(reason || 'ended')}`);
}

function handleMessage(msg) {
  if (msg.type === 'state') {
    renderAll(msg.data);
  } else if (msg.type === 'session_ended') {
    redirectEnded(msg.data && msg.data.reason);
  }
}

function connect() {
  if (ended) return;
  ws = new WebSocket(drtSocketUrl(sessionId));
  ws.onopen = () => {
    setConn(true);
    reconnectDelay = 1000;
  };
  ws.onmessage = (ev) => {
    try {
      handleMessage(JSON.parse(ev.data));
    } catch {}
  };
  ws.onerror = () => {
    try { ws.close(); } catch {}
  };
  ws.onclose = () => {
    setConn(false);
    if (ended) return;
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10000);
  };
}

function showCodeEntry() {
  show('code-entry', true);
  el('code-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const code = el('code-input').value.trim();
    if (code) window.location.href = `${BRACKET_PREFIX}?s=${encodeURIComponent(code)}`;
  });
}

async function init() {
  if (!sessionId) {
    showCodeEntry();
    return;
  }
  el('join-form').addEventListener('submit', handleJoinSubmit);
  el('bracket-search').addEventListener('input', () => applyBracketSearch(true));
  enableBracketDrag();
  new ResizeObserver(scheduleBracketLines).observe(el('bracket-canvas'));

  const { ok, status, data } = await getState(sessionId);
  if (!ok && (status === 404 || status === 410)) {
    redirectEnded('notfound');
    return;
  }
  if (ok && data) renderAll(data);
  connect();
}

init();
