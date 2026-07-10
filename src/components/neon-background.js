const GLOWS = {
  magenta: '#ff2bd6',
  violet: '#8b5cff',
  cyan: '#18e0ff',
  gold: '#ffcf4d',
  green: '#39ff14',
  red: '#ff3b6b',
  orange: '#ff8a3d'
};

const SHAPES = {
  dice: `<rect x="8" y="8" width="84" height="84" rx="16" fill="none" stroke="currentColor" stroke-width="4"/>
    <circle cx="30" cy="30" r="6" fill="currentColor"/><circle cx="70" cy="30" r="6" fill="currentColor"/>
    <circle cx="50" cy="50" r="6" fill="currentColor"/>
    <circle cx="30" cy="70" r="6" fill="currentColor"/><circle cx="70" cy="70" r="6" fill="currentColor"/>`,
  roulette: `<circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="4"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="50" cy="50" r="6" fill="currentColor"/>
    <g stroke="currentColor" stroke-width="2">
      <line x1="50" y1="8" x2="50" y2="92"/><line x1="8" y1="50" x2="92" y2="50"/>
      <line x1="20" y1="20" x2="80" y2="80"/><line x1="80" y1="20" x2="20" y2="80"/>
    </g>`,
  card: `<rect x="22" y="10" width="56" height="80" rx="9" fill="none" stroke="currentColor" stroke-width="4"/>
    <path d="M50 70 C40 60 32 53 32 45 C32 39 38 35 44 39 C47 41 50 45 50 45 C50 45 53 41 56 39 C62 35 68 39 68 45 C68 53 60 60 50 70 Z" fill="currentColor"/>
    <text x="29" y="26" font-family="Trebuchet MS, sans-serif" font-size="12" fill="currentColor">A</text>`,
  chip: `<circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="4"/>
    <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" stroke-width="3"/>
    <g stroke="currentColor" stroke-width="8">
      <line x1="50" y1="6" x2="50" y2="20"/><line x1="50" y1="80" x2="50" y2="94"/>
      <line x1="6" y1="50" x2="20" y2="50"/><line x1="80" y1="50" x2="94" y2="50"/>
      <line x1="19" y1="19" x2="29" y2="29"/><line x1="71" y1="71" x2="81" y2="81"/>
      <line x1="81" y1="19" x2="71" y2="29"/><line x1="29" y1="71" x2="19" y2="81"/>
    </g>`,
  crownChip: `<circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="4"/>
    <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M34 58 L30 38 L42 48 L50 34 L58 48 L70 38 L66 58 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <g stroke="currentColor" stroke-width="6">
      <line x1="50" y1="6" x2="50" y2="16"/><line x1="50" y1="84" x2="50" y2="94"/>
      <line x1="6" y1="50" x2="16" y2="50"/><line x1="84" y1="50" x2="94" y2="50"/>
    </g>`,
  spade: `<path d="M50 12 C50 12 16 40 16 60 C16 74 30 80 40 72 C38 82 32 86 26 88 L74 88 C68 86 62 82 60 72 C70 80 84 74 84 60 C84 40 50 12 50 12 Z" fill="currentColor"/>`,
  heart: `<path d="M50 86 C50 86 14 60 14 36 C14 22 28 16 40 24 C45 27 50 34 50 34 C50 34 55 27 60 24 C72 16 86 22 86 36 C86 60 50 86 50 86 Z" fill="currentColor"/>`,
  diamond: `<path d="M50 8 L86 50 L50 92 L14 50 Z" fill="currentColor"/>`,
  club: `<circle cx="50" cy="32" r="16" fill="currentColor"/>
    <circle cx="33" cy="56" r="16" fill="currentColor"/>
    <circle cx="67" cy="56" r="16" fill="currentColor"/>
    <path d="M44 54 L40 88 L60 88 L56 54 Z" fill="currentColor"/>`,
  seven: `<text x="50" y="78" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-weight="bold" font-size="84" fill="currentColor">7</text>`,
  dollar: `<text x="50" y="80" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-weight="bold" font-size="86" fill="currentColor">$</text>`,
  star: `<path d="M50 8 L61 38 L93 38 L67 58 L77 90 L50 70 L23 90 L33 58 L7 38 L39 38 Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>`,
  slotMachine: `<rect x="22" y="16" width="56" height="66" rx="10" fill="none" stroke="currentColor" stroke-width="4"/>
    <rect x="30" y="28" width="40" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="3"/>
    <text x="50" y="46" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-weight="bold" font-size="15" fill="currentColor">777</text>
    <rect x="34" y="60" width="32" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="3"/>
    <line x1="78" y1="34" x2="90" y2="28" stroke="currentColor" stroke-width="3"/><circle cx="91" cy="27" r="4" fill="currentColor"/>`,
  barSign: `<rect x="8" y="34" width="84" height="32" rx="8" fill="none" stroke="currentColor" stroke-width="4"/>
    <text x="50" y="58" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-weight="bold" font-size="22" fill="currentColor">BAR</text>`,
  gem: `<path d="M30 20 L70 20 L88 42 L50 88 L12 42 Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
    <path d="M30 20 L40 42 L60 42 L70 20 M12 42 L88 42 M40 42 L50 88 M60 42 L50 88" fill="none" stroke="currentColor" stroke-width="2"/>`,
  bell: `<path d="M50 16 C36 16 30 28 30 44 C30 60 24 66 20 72 L80 72 C76 66 70 60 70 44 C70 28 64 16 50 16 Z" fill="none" stroke="currentColor" stroke-width="4"/>
    <circle cx="50" cy="80" r="6" fill="currentColor"/>
    <line x1="50" y1="9" x2="50" y2="16" stroke="currentColor" stroke-width="4"/>`,
  cherries: `<circle cx="34" cy="74" r="14" fill="none" stroke="currentColor" stroke-width="4"/>
    <circle cx="66" cy="74" r="14" fill="none" stroke="currentColor" stroke-width="4"/>
    <path d="M34 60 C40 36 62 24 80 22 M66 60 C66 44 72 30 80 22" fill="none" stroke="currentColor" stroke-width="3"/>`,
  plum: `<circle cx="50" cy="56" r="28" fill="none" stroke="currentColor" stroke-width="4"/>
    <path d="M50 30 Q60 18 72 20 Q64 32 50 30 Z" fill="currentColor"/>`,
  sparkle: `<path d="M50 8 C54 38 62 46 92 50 C62 54 54 62 50 92 C46 62 38 54 8 50 C38 46 46 38 50 8 Z" fill="currentColor"/>`,
  questionStar: `<path d="M50 8 L60 30 L84 26 L70 46 L90 60 L66 62 L66 86 L50 70 L34 86 L34 62 L10 60 L30 46 L16 26 L40 30 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <text x="50" y="62" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-weight="bold" font-size="30" fill="currentColor">?</text>`
};

const SUITS = ['spade', 'heart', 'diamond', 'club'];
const TARGET_COLUMN_PX = 150;
const MAX_COLUMNS = 10;
const SYMBOL_MIN_PX = 70;
const BASE_DURATION = 26;

let COLUMNS, COLUMN_VW, SYMBOL_VW, SYMBOL_SIZE_PX, SYMBOLS_PER_SET;

function computeLayout() {
  COLUMNS = Math.min(MAX_COLUMNS, Math.max(3, Math.round(window.innerWidth / TARGET_COLUMN_PX)));
  COLUMN_VW = 100 / COLUMNS;
  SYMBOL_VW = COLUMN_VW * 0.78;
  SYMBOL_SIZE_PX = Math.max(SYMBOL_MIN_PX, (SYMBOL_VW / 100) * window.innerWidth);
  SYMBOLS_PER_SET = Math.max(4, Math.round(window.innerHeight / SYMBOL_SIZE_PX));
}

const SHAPE_POOL = Object.keys(SHAPES).concat(SUITS);
const GLOW_KEYS = Object.keys(GLOWS);

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickAvoiding(list, forbidden) {
  let value = pick(list);
  while (forbidden.includes(value)) {
    value = pick(list);
  }
  return value;
}

function makeItem(shape, avoidGlows) {
  const widthVw = (SYMBOL_VW * randomBetween(0.9, 1.04)).toFixed(2);
  return {
    shape,
    glow: pickAvoiding(GLOW_KEYS, avoidGlows),
    width: `clamp(${SYMBOL_MIN_PX}px, ${widthVw}vw, 110px)`,
    opacity: randomBetween(0.20, 0.35).toFixed(2)
  };
}

function buildSequence(count) {
  const sequence = [];
  for (let index = 0; index < count; index += 1) {
    const previous = index > 0 ? sequence[index - 1] : null;
    const shape = pickAvoiding(SHAPE_POOL, previous ? [previous.shape] : []);
    sequence.push(makeItem(shape, previous ? [previous.glow] : []));
  }
  const first = sequence[0];
  const last = sequence[count - 1];
  if (last.shape === first.shape || last.glow === first.glow) {
    const above = sequence[count - 2];
    const shape = pickAvoiding(SHAPE_POOL, [above.shape, first.shape]);
    sequence[count - 1] = makeItem(shape, [above.glow, first.glow]);
  }
  return sequence;
}

function buildGlyph(item) {
  const cell = document.createElement('div');
  cell.className = 'neon-cell';
  cell.style.height = `${(100 / SYMBOLS_PER_SET).toFixed(4)}vh`;
  const glyph = document.createElement('div');
  glyph.className = 'neon-glyph';
  glyph.style.cssText = `--glow:${GLOWS[item.glow]};opacity:${item.opacity}`;
  glyph.innerHTML =
    `<svg viewBox="0 0 100 100" style="width:${item.width};height:auto" aria-hidden="true">${SHAPES[item.shape]}</svg>`;
  cell.appendChild(glyph);
  return cell;
}

function buildColumn(columnIndex) {
  const column = document.createElement('div');
  column.className = 'neon-column';
  column.style.cssText = `left:${(columnIndex / COLUMNS) * 100}%;width:${(100 / COLUMNS).toFixed(4)}%`;

  const track = document.createElement('div');
  track.className = 'neon-track';
  const rollsDown = columnIndex % 2 === 0;
  const duration = (BASE_DURATION * randomBetween(0.82, 1.22)).toFixed(2);
  track.style.animation = `${rollsDown ? 'reelDown' : 'reelUp'} ${duration}s linear infinite`;

  const sequence = buildSequence(SYMBOLS_PER_SET);
  for (let copy = 0; copy < 2; copy += 1) {
    sequence.forEach((item) => track.appendChild(buildGlyph(item)));
  }

  column.appendChild(track);
  return column;
}

function syncLayerPlayback(layer) {
  if (!layer) return;
  layer.classList.toggle('is-paused', document.visibilityState === 'hidden');
}

function mountBackground() {
  const existing = document.querySelector('[data-neon-background]');
  if (existing) existing.remove();
  computeLayout();
  const layer = document.createElement('div');
  layer.className = 'neon-layer';
  layer.dataset.neonBackground = 'true';
  for (let columnIndex = 0; columnIndex < COLUMNS; columnIndex += 1) {
    layer.appendChild(buildColumn(columnIndex));
  }
  const scrim = document.createElement('div');
  scrim.className = 'neon-scrim';
  layer.appendChild(scrim);
  document.body.prepend(layer);
  syncLayerPlayback(layer);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountBackground);
} else {
  mountBackground();
}

document.addEventListener('visibilitychange', () => {
  syncLayerPlayback(document.querySelector('[data-neon-background]'));
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(mountBackground, 200);
});
