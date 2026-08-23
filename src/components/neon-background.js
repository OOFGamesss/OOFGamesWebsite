import { getSettings, onChange, reportTier } from './graphics-settings.js';

const REEL_DIR = '/neon-reels';
const REEL_COUNT = 14;
const REEL_ASPECT = 0.25;

const TARGET_COLUMN_PX = 150;
const MAX_COLUMNS = 7;
const REDUCED_COLUMNS = 3;
const MOVING_COLUMN_STEP = 1;

const SCROLL_PX_PER_SEC = 35;
const SPEED_JITTER = [0.82, 1.22];

const PROBE_FRAMES = 40;
const PROBE_REDUCED_MS = 22;
const PROBE_STATIC_MS = 32;
const PROBE_SETTLE_MS = 1200;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function columnCount(tier, animating) {
  const max = animating && tier === 'reduced' ? REDUCED_COLUMNS : MAX_COLUMNS;
  return Math.min(max, Math.max(3, Math.round(window.innerWidth / TARGET_COLUMN_PX)));
}

function tilePx(columns) {
  return Math.round(window.innerWidth / columns / REEL_ASPECT);
}

function pickStrips(count) {
  const pool = Array.from({ length: REEL_COUNT }, (_, index) => index + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: count }, (_, index) => pool[index % pool.length]);
}

function buildColumn(index, columns, strip, tileHeight, animate) {
  const column = document.createElement('div');
  column.className = 'neon-column';
  column.style.cssText = `left:${(index / columns) * 100}%;width:${(100 / columns).toFixed(4)}%`;

  const reel = document.createElement('div');
  reel.className = 'neon-reel';
  reel.style.setProperty('--tile', `${tileHeight}px`);
  reel.style.backgroundImage = `url("${REEL_DIR}/${strip}.webp")`;
  reel.style.backgroundSize = `100% ${tileHeight}px`;
  reel.style.backgroundPositionY = `${-Math.round(Math.random() * tileHeight)}px`;
  reel.style.height = `calc(100% + ${tileHeight}px)`;

  if (animate) {
    const duration = (tileHeight / SCROLL_PX_PER_SEC) * randomBetween(...SPEED_JITTER);
    reel.classList.add('is-animated');
    reel.style.animation = `${Math.floor(index / MOVING_COLUMN_STEP) % 2 === 0 ? 'reelDown' : 'reelUp'} ${duration.toFixed(2)}s linear infinite`;
  }

  column.appendChild(reel);
  return column;
}

function syncLayerPlayback(layer) {
  if (!layer) return;
  layer.classList.toggle('is-paused', document.visibilityState === 'hidden');
}

let mountedColumns = 0;
let mountedTile = 0;

function mount() {
  const { backgroundMotion, tier } = getSettings();
  const columns = columnCount(tier, backgroundMotion);
  const tileHeight = tilePx(columns);
  const strips = pickStrips(columns);
  const parity = MOVING_COLUMN_STEP > 1 && Math.random() < 0.5 ? 1 : 0;

  const layer = document.createElement('div');
  layer.className = 'neon-layer';
  layer.dataset.neonBackground = 'true';

  for (let index = 0; index < columns; index += 1) {
    const animate = backgroundMotion && index % MOVING_COLUMN_STEP === parity;
    layer.appendChild(buildColumn(index, columns, strips[index], tileHeight, animate));
  }

  const scrim = document.createElement('div');
  scrim.className = 'neon-scrim';
  layer.appendChild(scrim);

  const existing = document.querySelector('[data-neon-background]');
  if (existing) existing.remove();
  document.body.prepend(layer);
  syncLayerPlayback(layer);

  mountedColumns = columns;
  mountedTile = tileHeight;

  if (backgroundMotion && tier === 'full') probeFrameRate();
}

function reflow() {
  const layer = document.querySelector('[data-neon-background]');
  if (!layer) return;

  const settings = getSettings();
  const columns = columnCount(settings.tier, settings.backgroundMotion);
  if (columns !== mountedColumns) {
    mount();
    return;
  }

  const tileHeight = tilePx(columns);
  if (tileHeight === mountedTile) return;

  for (const reel of layer.querySelectorAll('.neon-reel')) {
    reel.style.setProperty('--tile', `${tileHeight}px`);
    reel.style.backgroundSize = `100% ${tileHeight}px`;
    reel.style.height = `calc(100% + ${tileHeight}px)`;
  }
  mountedTile = tileHeight;
}

let probed = false;

function runProbe() {
  const samples = [];
  let last = 0;
  const step = (now) => {
    if (document.visibilityState === 'hidden') return;
    if (last) samples.push(now - last);
    last = now;
    if (samples.length < PROBE_FRAMES) {
      requestAnimationFrame(step);
      return;
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    if (median > PROBE_STATIC_MS) reportTier('static');
    else if (median > PROBE_REDUCED_MS) reportTier('reduced');
  };
  requestAnimationFrame(step);
}

function probeFrameRate() {
  if (probed) return;
  probed = true;
  const start = () => setTimeout(runProbe, PROBE_SETTLE_MS);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

function scheduleMount() {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(mount, { timeout: 500 });
  else setTimeout(mount, 1);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleMount);
} else {
  scheduleMount();
}

document.addEventListener('visibilitychange', () => {
  syncLayerPlayback(document.querySelector('[data-neon-background]'));
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(reflow, 300);
}, { passive: true });

window.addEventListener('orientationchange', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(mount, 400);
});

onChange(mount);
