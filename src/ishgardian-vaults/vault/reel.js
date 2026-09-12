const OUTCOME_COLOURS = ['#ef4444', '#9aa0a6', '#3ddc84', '#2f7fff', '#a855f7', '#ffcf4d', '#ff9f1a'];

const BONUS_OUTCOME = 6;

const NO_WIN_OUTCOME = 0;

function glyphFor(outcome, art) {
  if (outcome === NO_WIN_OUTCOME) return 'cross';
  if (outcome === BONUS_OUTCOME) return art ? 'art' : 'burst';
  return 'art';
}

function colourFor(outcome) {
  return OUTCOME_COLOURS[outcome] || OUTCOME_COLOURS[0];
}

const TILE_ASPECT = 0.84;
const TILE_GAP = 12;
const TILE_RADIUS = 10;
const TILES_PER_SECOND = 48;
const DECAY = 3.6;
const MIN_BRAKE_MS = 2800;
const CRAWL_TILES_PER_SECOND = 0.34;
const OFF_CENTRE = 0.3;
const FLASH_MS = 780;
const WELL = '#070a0f';

function hexToRgba(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundedPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function renderTileSprite(colour, width, height, ratio, image, outcome) {
  const glyph = glyphFor(outcome, image);
  const loud = outcome === BONUS_OUTCOME;
  const sprite = document.createElement('canvas');
  sprite.width = Math.max(1, Math.round(width * ratio));
  sprite.height = Math.max(1, Math.round(height * ratio));
  const ctx = sprite.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  roundedPath(ctx, 0.5, 0.5, width - 1, height - 1, TILE_RADIUS);
  ctx.save();
  ctx.clip();

  const body = ctx.createLinearGradient(0, 0, 0, height);
  body.addColorStop(0, '#171d26');
  body.addColorStop(0.55, '#0f141b');
  body.addColorStop(1, '#0a0e14');
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, width, height);

  const wash = ctx.createLinearGradient(0, height * 0.34, 0, height);
  wash.addColorStop(0, hexToRgba(colour, 0));
  wash.addColorStop(1, hexToRgba(colour, loud ? 0.6 : 0.32));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  const halo = ctx.createRadialGradient(width / 2, height * 0.45, 2, width / 2, height * 0.45, width * 0.6);
  halo.addColorStop(0, hexToRgba(colour, loud ? 0.55 : 0.26));
  halo.addColorStop(1, hexToRgba(colour, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  if (glyph === 'burst') {
    const cx = width / 2;
    const cy = height * 0.45;
    const outer = height * 0.22;
    const inner = outer * 0.44;
    ctx.beginPath();
    for (let point = 0; point < 16; point += 1) {
      const angle = -Math.PI / 2 + (point * Math.PI) / 8;
      const radius = point % 2 === 0 ? outer : inner;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#fff6d6';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, inner * 0.66, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(colour, 1);
    ctx.fill();
  } else if (glyph === 'cross') {
    const arm = height * 0.15;
    const cx = width / 2;
    const cy = height * 0.45;
    ctx.strokeStyle = hexToRgba(colour, 0.95);
    ctx.lineWidth = Math.max(3, height * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy - arm);
    ctx.lineTo(cx + arm, cy + arm);
    ctx.moveTo(cx + arm, cy - arm);
    ctx.lineTo(cx - arm, cy + arm);
    ctx.stroke();
  } else if (glyph === 'art' && image && image.complete && image.naturalWidth > 0) {
    const box = height * 0.5;
    const scale = Math.min(box / image.naturalWidth, box / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    ctx.globalAlpha = 0.96;
    ctx.drawImage(
      image, (width - drawWidth) / 2, height * 0.45 - drawHeight / 2, drawWidth, drawHeight);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = hexToRgba(colour, 0.7);
    ctx.fillRect(width * 0.26, height * 0.32, width * 0.48, height * 0.26);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.8)';
    ctx.fillRect(width * 0.26, height * 0.43, width * 0.48, 4);
  }

  const sheen = ctx.createLinearGradient(0, 0, width * 1.15, height);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(0.3, 'rgba(255, 255, 255, 0.07)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height);

  const top = ctx.createLinearGradient(0, 0, 0, height * 0.16);
  top.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  top.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, width, height * 0.16);

  const left = ctx.createLinearGradient(0, 0, width * 0.11, 0);
  left.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  left.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, width * 0.11, height);

  const right = ctx.createLinearGradient(width, 0, width * 0.89, 0);
  right.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  right.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = right;
  ctx.fillRect(width * 0.89, 0, width * 0.11, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.fillRect(1, 1, width - 2, 1);

  const band = ctx.createLinearGradient(0, height - 8, 0, height);
  band.addColorStop(0, hexToRgba(colour, 0.92));
  band.addColorStop(1, hexToRgba(colour, 0.5));
  ctx.fillStyle = band;
  ctx.fillRect(0, height - 7, width, 7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(0, height - 8, width, 1);

  ctx.restore();

  roundedPath(ctx, 1.5, 1.5, width - 3, height - 3, TILE_RADIUS - 1);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.stroke();

  roundedPath(ctx, 0.5, 0.5, width - 1, height - 1, TILE_RADIUS);
  ctx.lineWidth = 1;
  ctx.strokeStyle = hexToRgba(colour, 0.48);
  ctx.stroke();

  return sprite;
}

export function createReel({ canvas, reel, durationMs, art = [], reducedMotion }) {
  const context = canvas.getContext('2d');
  const state = {
    reel,
    durationMs,
    offset: 0,
    startedAt: 0,
    landingIndex: null,
    landOffset: 0,
    landDrift: 0,
    decelFrom: null,
    decelAt: 0,
    decelStart: 0,
    decelDistance: 0,
    crawlPart: 0,
    decayPart: 0,
    settleMs: 0,
    finished: false,
    frame: 0,
    onLanded: null,
    onTick: null,
    centreIndex: null,
    width: 0,
    tileW: 0,
    tileH: 0,
    pitch: 0,
    cruise: 0,
    sprites: [],
    spriteKey: '',
    blur: 0,
    lastNow: 0,
    lastOffset: 0,
    flashUntil: 0,
  };

  function crawlSpeed() {
    return CRAWL_TILES_PER_SECOND * state.pitch;
  }

  function brakeAverageSpeed() {
    return crawlSpeed() + (state.cruise - crawlSpeed()) / (DECAY + 1);
  }

  function offsetForIndex(index) {
    return index * state.pitch + state.tileW / 2 - state.width / 2;
  }

  function tierAt(index) {
    const length = state.reel.length;
    return state.reel[((index % length) + length) % length];
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    state.width = rect.width;
    state.tileH = Math.round(rect.height);
    state.tileW = Math.round(state.tileH * TILE_ASPECT);
    state.pitch = state.tileW + TILE_GAP;
    state.cruise = state.pitch * TILES_PER_SECOND;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const signature = `${state.tileW}x${state.tileH}@${ratio}`;
    if (state.tileH > 8 && state.tileW > 0 && signature !== state.spriteKey) {
      state.spriteKey = signature;
      state.sprites = OUTCOME_COLOURS.map((colour, outcome) =>
        renderTileSprite(colour, state.tileW, state.tileH, ratio, art[outcome], outcome)
      );
    }

    if (state.finished && state.landingIndex !== null) {
      state.offset = offsetForIndex(state.landingIndex) + state.landDrift * state.tileW;
      state.landOffset = state.offset;
    }
  }

  function smear(strength) {
    if (reducedMotion) return;
    const distance = strength * state.pitch * 0.11;
    if (distance < 0.7) return;
    const { width, tileH } = state;
    context.save();
    context.globalAlpha = 0.26;
    context.drawImage(canvas, -distance, 0, width, tileH);
    context.drawImage(canvas, distance, 0, width, tileH);
    context.restore();
  }

  function draw(now) {
    const { width, tileH, tileW, pitch } = state;
    if (!width || tileH < 8 || !state.reel.length || !state.sprites.length) return;

    context.clearRect(0, 0, width, tileH);
    context.fillStyle = WELL;
    context.fillRect(0, 0, width, tileH);

    const first = Math.floor(state.offset / pitch);
    const shift = state.offset - first * pitch;
    const visible = Math.ceil(width / pitch) + 2;

    for (let step = 0; step < visible; step += 1) {
      const index = first + step;
      if (index < 0) continue;
      const sprite = state.sprites[tierAt(index)];
      if (sprite) context.drawImage(sprite, step * pitch - shift, 0, tileW, tileH);
    }

    smear(state.blur);

    const cx = width / 2;
    const cy = tileH / 2;
    const walls = state.finished ? 0.66 : 1;

    const spot = context.createRadialGradient(cx, cy, tileH * 0.52, cx, cy, width * 0.56);
    spot.addColorStop(0, 'rgba(6, 9, 14, 0)');
    spot.addColorStop(0.42, `rgba(6, 9, 14, ${0.44 * walls})`);
    spot.addColorStop(0.72, `rgba(6, 9, 14, ${0.86 * walls})`);
    spot.addColorStop(1, `rgba(6, 9, 14, ${0.97 * walls})`);
    context.fillStyle = spot;
    context.fillRect(0, 0, width, tileH);

    const beam = context.createLinearGradient(cx - pitch * 0.8, 0, cx + pitch * 0.8, 0);
    beam.addColorStop(0, 'rgba(255, 255, 255, 0)');
    beam.addColorStop(0.5, 'rgba(255, 255, 255, 0.055)');
    beam.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = beam;
    context.fillRect(cx - pitch * 0.8, 0, pitch * 1.6, tileH);

    if (state.finished && state.landingIndex !== null) {
      const colour = colourFor(tierAt(state.landingIndex));
      const x = cx - tileW / 2 - state.landDrift * state.tileW;
      const tileCx = x + tileW / 2;
      const time = now === undefined ? performance.now() : now;

      if (state.flashUntil > time && !reducedMotion) {
        const remaining = (state.flashUntil - time) / FLASH_MS;
        const fade = remaining * remaining;
        context.save();
        roundedPath(context, x, 0, tileW, tileH, TILE_RADIUS);
        context.clip();
        context.fillStyle = `rgba(255, 255, 255, ${0.46 * fade})`;
        context.fillRect(x, 0, tileW, tileH);
        context.restore();

        const bloom = context.createRadialGradient(tileCx, cy, tileW * 0.32, tileCx, cy, width * 0.4);
        bloom.addColorStop(0, hexToRgba(colour, 0.5 * fade));
        bloom.addColorStop(1, hexToRgba(colour, 0));
        context.fillStyle = bloom;
        context.fillRect(0, 0, width, tileH);
      }

      context.save();
      context.shadowColor = hexToRgba(colour, 0.8);
      context.shadowBlur = 24;
      context.lineWidth = 2;
      context.strokeStyle = hexToRgba(colour, 0.95);
      roundedPath(context, x + 1, 1, tileW - 2, tileH - 2, TILE_RADIUS);
      context.stroke();
      context.restore();
    }
  }

  function emitTick() {
    if (!state.onTick || state.finished) return;
    const centre = Math.round((state.offset + state.width / 2 - state.tileW / 2) / state.pitch);
    if (centre === state.centreIndex) return;
    const first = state.centreIndex === null;
    state.centreIndex = centre;
    if (!first && centre >= 0) state.onTick(tierAt(centre), state.blur);
  }

  function tick(now) {
    let justLanded = false;

    if (state.decelAt === 0) {
      const elapsed = (now - state.startedAt) / 1000;
      state.offset = elapsed * state.cruise;
      if (state.decelFrom !== null && state.offset >= state.decelFrom) {
        state.decelAt = now;
        state.decelStart = state.offset;
        state.decelDistance = Math.max(1, state.landOffset - state.offset);
        const brake = state.decelDistance / brakeAverageSpeed();
        state.settleMs = Math.max(200, brake * 1000);
        state.crawlPart = crawlSpeed() * brake;
        state.decayPart = state.decelDistance - state.crawlPart;
      }
    } else if (!state.finished) {
      const s = Math.min(1, (now - state.decelAt) / state.settleMs);
      state.offset =
        state.decelStart + state.crawlPart * s + state.decayPart * (1 - Math.pow(1 - s, DECAY + 1));
      if (s >= 1) {
        state.offset = state.landOffset;
        state.finished = true;
        state.flashUntil = now + FLASH_MS;
        justLanded = true;
      }
    }

    if (state.finished) {
      state.blur = 0;
    } else {
      const delta = Math.max(1, now - state.lastNow);
      const speed = ((state.offset - state.lastOffset) / delta) * 1000;
      state.blur = Math.min(1, Math.max(0, speed / state.cruise));
      state.lastNow = now;
      state.lastOffset = state.offset;
    }

    emitTick();
    draw(now);

    if (justLanded && state.onLanded) state.onLanded();

    if (!state.finished || state.flashUntil > now) {
      state.frame = requestAnimationFrame(tick);
    }
  }

  return {
    start() {
      resize();
      state.startedAt = performance.now();
      state.lastNow = state.startedAt;
      state.lastOffset = 0;
      state.centreIndex = null;
      state.frame = requestAnimationFrame(tick);
    },

    idle() {
      resize();
      state.offset = Math.random() * state.reel.length * state.pitch;
      draw();
    },

    land(index, stopInMs) {
      if (state.finished || state.landingIndex !== null) return;
      state.landingIndex = index;
      state.landDrift = (Math.random() * 2 - 1) * OFF_CENTRE;

      const total = Math.max(MIN_BRAKE_MS, stopInMs) / 1000;
      const speed = state.cruise;
      const average = brakeAverageSpeed();
      const strip = state.reel.length * state.pitch;
      const target = offsetForIndex(index) + state.landDrift * state.tileW;

      const floor = average * total;
      const laps = Math.ceil((state.offset + floor - target) / strip);
      state.landOffset = target + laps * strip;

      const distance = state.landOffset - state.offset;
      const brake = Math.min(total, Math.max(MIN_BRAKE_MS / 1000, (speed * total - distance) / (speed - average)));
      state.decelFrom = state.landOffset - average * brake;
    },

    onLanded(callback) {
      state.onLanded = callback;
      if (state.finished) callback();
    },

    onTick(callback) {
      state.onTick = callback;
    },

    resize() {
      resize();
      draw();
    },

    stop() {
      state.finished = true;
      state.flashUntil = 0;
      cancelAnimationFrame(state.frame);
    },

    tierAt(index) {
      return tierAt(index);
    },
  };
}

export { OUTCOME_COLOURS, NO_WIN_OUTCOME, BONUS_OUTCOME, colourFor };
