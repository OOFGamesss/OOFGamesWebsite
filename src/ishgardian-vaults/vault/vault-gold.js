import { getSettings, onChange } from '../../components/graphics-settings.js';

const ASCENT_MS = 2600;
const ASCENT_SWAP_MS = 1500;
const ASCENT_HOLD_MS = 1720;
const ASCENT_CLOUD_MS = 1900;

const DESCENT_MS = 2200;
const DESCENT_SWAP_MS = 1200;
const DESCENT_HOLD_MS = 1400;
const DESCENT_CLOUD_MS = 1500;

const PLAIN_ENTER_MS = 900;
const PLAIN_ENTER_SWAP_MS = 450;
const PLAIN_EXIT_MS = 700;
const PLAIN_EXIT_SWAP_MS = 350;

const AMBIENT_RAYS = 0.22;
const PEAK_BLOOM = 0.94;
const PEAK_DARK = 0.88;
const RISE_LIFT = 320;

const DOT_TINTS = [
  ['#fffbe9', 'rgba(255, 246, 214, 0.62)'],
  ['#fff3cf', 'rgba(255, 226, 150, 0.6)'],
  ['#ffe6a6', 'rgba(255, 202, 92, 0.58)'],
  ['#ffd06a', 'rgba(255, 176, 32, 0.55)'],
];

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInCubic(t) {
  return t * t * t;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function surface(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function makeDot(size, inner, mid) {
  const canvas = surface(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.34, mid);
  grad.addColorStop(1, 'rgba(255, 176, 32, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function makeStar(size) {
  const canvas = surface(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const r = size / 2;
  const points = [
    [0.5, 0], [0.58, 0.42], [1, 0.5], [0.58, 0.58],
    [0.5, 1], [0.42, 0.58], [0, 0.5], [0.42, 0.42],
  ];
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, '#fffbe9');
  grad.addColorStop(0.4, '#ffd97a');
  grad.addColorStop(1, 'rgba(255, 176, 32, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const px = x * size;
    const py = y * size;
    if (index) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
  return canvas;
}

function makeRays(size, seed) {
  const canvas = surface(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const rnd = mulberry(seed);
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, size * 0.05, r, r, r);
  grad.addColorStop(0, 'rgba(255, 250, 232, 0.5)');
  grad.addColorStop(0.42, 'rgba(255, 214, 120, 0.2)');
  grad.addColorStop(1, 'rgba(255, 190, 60, 0)');
  ctx.translate(r, r);
  ctx.fillStyle = grad;
  const spokes = 18;
  let angle = rnd() * Math.PI * 2;
  for (let i = 0; i < spokes; i += 1) {
    const width = 0.026 + rnd() * 0.072;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, angle, angle + width);
    ctx.closePath();
    ctx.fill();
    angle += (Math.PI * 2) / spokes + (rnd() - 0.5) * 0.08;
  }
  return canvas;
}

function makeCloud(width, height, seed) {
  const canvas = surface(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const rnd = mulberry(seed);
  for (let i = 0; i < 46; i += 1) {
    const cx = width * (0.06 + rnd() * 0.88);
    const cy = height * (0.32 + rnd() * 0.46);
    const rr = height * (0.15 + rnd() * 0.34);
    const grad = ctx.createRadialGradient(cx, cy - rr * 0.22, 0, cx, cy, rr);
    grad.addColorStop(0, 'rgba(255, 251, 238, 0.46)');
    grad.addColorStop(0.5, 'rgba(255, 228, 172, 0.2)');
    grad.addColorStop(1, 'rgba(255, 198, 100, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

const gold = {
  canvas: null,
  ctx: null,
  dpr: 1,
  w: 0,
  h: 0,
  sprites: null,
  ready: false,

  raf: null,
  last: 0,
  clock: 0,

  particles: [],
  clouds: [],
  count: 0,

  bonus: false,
  fieldAlpha: 0,
  fieldFrom: 0,
  fieldTo: 0,
  fieldAt: 0,
  fieldMs: 1,

  rays: 0,
  bloom: 0,
  dark: 0,
  lift: 0,
  fallScale: 1,

  phase: '',
  phaseAt: 0,
  phaseMs: 0,
  phaseT: 0,
  swapMs: 0,
  swapDone: true,
  onSwap: null,
  onDone: null,
  guardTimer: 0,

  init() {
    if (this.canvas) return;
    this.canvas = document.getElementById('vault-gold');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      this.canvas = null;
      return;
    }
    this.buildSprites();
    this.ready = true;
    document.addEventListener('visibilitychange', () => this.onVisibility());
    onChange(() => this.onQuality());
  },

  plain() {
    const settings = getSettings();
    return settings.quality === 'low' && settings.qualityChosen === true;
  },

  buildSprites() {
    const plain = this.plain();
    this.sprites = {
      dots: DOT_TINTS.map(([inner, mid]) => makeDot(32, inner, mid)),
      star: makeStar(64),
      rays: plain ? null : [makeRays(512, 11), makeRays(512, 29)],
      clouds: plain ? [] : [makeCloud(360, 200, 5), makeCloud(360, 200, 17), makeCloud(360, 200, 41)],
    };
  },

  onQuality() {
    if (!this.ready) return;
    this.buildSprites();
    this.sizeField(true);
  },

  live(on) {
    if (!this.canvas) return;
    this.canvas.classList.toggle('is-live', on);
  },

  resize() {
    if (!this.ready || !this.canvas.classList.contains('is-live')) return;
    this.sizeField(false);
  },

  sizeField(force) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    if (!force && w === this.w && h === this.h && dpr === this.dpr) return;

    const oldW = this.w || w;
    const oldH = this.h || h;
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const base = this.plain() ? 70 : 150;
    this.count = Math.round(base * clamp((w * h) / (1920 * 1080), 0.45, 1.35));

    for (const p of this.particles) {
      p.x *= w / oldW;
      p.y *= h / oldH;
    }
    while (this.particles.length > this.count) this.particles.pop();
    while (this.particles.length < this.count) this.particles.push(this.spawn({}, true));
  },

  spawn(p, initial) {
    const d = Math.random();
    p.d = d;
    p.x = Math.random() * this.w;
    p.y = initial ? Math.random() * (this.h + 40) - 40 : -20 - Math.random() * 60;
    p.r = lerp(0.7, 3.4, d * d);
    p.vy = lerp(10, 34, d) * (0.85 + Math.random() * 0.3);
    p.vx = (Math.random() - 0.5) * 6;
    p.sway = lerp(6, 26, d);
    p.swaySpeed = 0.25 + Math.random() * 0.5;
    p.swayPhase = Math.random() * Math.PI * 2;
    p.alpha = lerp(0.35, 0.95, d);
    p.tint = (Math.random() * DOT_TINTS.length) | 0;
    p.star = Math.random() < 0.12;
    p.twinkle = p.star ? 0.6 + Math.random() * 0.8 : 1.2 + Math.random() * 2.4;
    p.twinklePhase = Math.random() * Math.PI * 2;
    p.rot = Math.random() * Math.PI * 2;
    p.spin = (0.2 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1);
    return p;
  },

  setField(target, ms) {
    this.fieldFrom = this.fieldAlpha;
    this.fieldTo = target;
    this.fieldAt = performance.now();
    this.fieldMs = Math.max(1, ms);
  },

  setBonus(on) {
    if (!this.ready) return;
    this.bonus = !!on;
    this.setField(this.bonus ? 1 : 0, this.bonus ? 900 : 700);
    if (this.bonus) this.rays = this.plain() ? 0 : AMBIENT_RAYS;
    this.start();
  },

  start() {
    if (!this.ready) return;
    if (!this.canvas.classList.contains('is-live')) {
      this.live(true);
      this.sizeField(true);
    } else {
      this.sizeField(false);
    }
    if (this.raf !== null) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((time) => this.loop(time));
  },

  stop() {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
    this.live(false);
    this.canvas.classList.remove('is-transition');
  },

  onVisibility() {
    if (!this.ready) return;
    if (document.hidden) {
      if (this.phase) this.finishPhase();
      if (this.raf !== null) {
        cancelAnimationFrame(this.raf);
        this.raf = null;
      }
      return;
    }
    if (this.bonus || this.fieldAlpha > 0.001 || this.phase) {
      this.last = performance.now();
      this.start();
    }
  },

  ascend(onSwap) {
    return this.play('enter', onSwap);
  },

  descend(onSwap) {
    return this.play('exit', onSwap);
  },

  play(phase, onSwap) {
    if (!this.ready) {
      if (onSwap) onSwap();
      return Promise.resolve();
    }
    if (this.phase) this.finishPhase();

    const plain = this.plain();
    const enter = phase === 'enter';
    this.phase = phase;
    this.phaseAt = performance.now();
    this.phaseT = 0;
    if (plain) {
      this.phaseMs = enter ? PLAIN_ENTER_MS : PLAIN_EXIT_MS;
      this.swapMs = enter ? PLAIN_ENTER_SWAP_MS : PLAIN_EXIT_SWAP_MS;
    } else {
      this.phaseMs = enter ? ASCENT_MS : DESCENT_MS;
      this.swapMs = enter ? ASCENT_SWAP_MS : DESCENT_SWAP_MS;
    }
    this.swapDone = false;
    this.onSwap = onSwap || null;

    this.bonus = enter;
    this.setField(enter ? 1 : 0, enter ? 400 : DESCENT_CLOUD_MS);
    this.buildClouds(enter, plain);

    this.canvas.classList.add('is-transition');
    this.start();

    window.clearTimeout(this.guardTimer);
    this.guardTimer = window.setTimeout(() => {
      if (this.phase === phase) this.finishPhase();
    }, this.phaseMs + 400);

    return new Promise((resolve) => {
      this.onDone = resolve;
    });
  },

  buildClouds(enter, plain) {
    this.clouds = [];
    if (plain || !this.sprites.clouds.length) return;
    const rnd = mulberry(enter ? 91 : 137);
    const total = 5;
    for (let i = 0; i < total; i += 1) {
      const depth = i / (total - 1);
      const scale = lerp(0.8, 1.7, depth) * (0.9 + rnd() * 0.3);
      const y0 = enter ? 1.14 + depth * 0.26 : -0.55 - depth * 0.3;
      const y1 = enter ? -0.7 - depth * 0.35 : 1.25 + depth * 0.3;
      this.clouds.push({
        sprite: this.sprites.clouds[i % this.sprites.clouds.length],
        x: (rnd() - 0.5) * 0.5 + (i % 2 ? 0.72 : 0.28),
        y0,
        y1,
        s0: enter ? scale : scale * 1.35,
        s1: enter ? scale * 1.42 : scale,
        alpha: lerp(0.55, 1, depth),
        flip: rnd() < 0.5,
      });
    }
  },

  runSwap() {
    if (this.swapDone) return;
    this.swapDone = true;
    const fn = this.onSwap;
    this.onSwap = null;
    if (fn) {
      try {
        fn();
      } catch {}
    }
  },

  finishPhase() {
    if (!this.phase) return;
    window.clearTimeout(this.guardTimer);
    this.runSwap();
    const enter = this.phase === 'enter';
    this.phase = '';
    this.phaseT = 0;
    this.clouds = [];
    this.bloom = 0;
    this.dark = 0;
    this.lift = 0;
    this.fallScale = 1;
    this.rays = enter && !this.plain() ? AMBIENT_RAYS : 0;
    this.bonus = enter;
    this.setField(enter ? 1 : 0, enter ? 400 : 500);
    if (this.canvas) this.canvas.classList.remove('is-transition');
    const done = this.onDone;
    this.onDone = null;
    if (done) done();
  },

  loop(time) {
    this.raf = requestAnimationFrame((next) => this.loop(next));
    const dt = Math.min(0.05, Math.max(0, (time - this.last) / 1000));
    this.last = time;
    this.clock += dt;

    const fieldT = clamp01((time - this.fieldAt) / this.fieldMs);
    this.fieldAlpha = lerp(this.fieldFrom, this.fieldTo, easeOutCubic(fieldT));

    if (this.phase) {
      this.phaseT = time - this.phaseAt;
      if (!this.swapDone && this.phaseT >= this.swapMs) this.runSwap();
      this.shape();
      if (this.phaseT >= this.phaseMs) this.finishPhase();
    }

    this.move(dt);
    this.paint();

    if (!this.phase && !this.bonus && this.fieldAlpha <= 0.002) this.stop();
  },

  shape() {
    const t = this.phaseT;
    if (this.plain()) {
      const half = this.swapMs;
      this.bloom = this.phase === 'enter'
        ? (t < half ? easeInCubic(clamp01(t / half)) * PEAK_BLOOM : PEAK_BLOOM * (1 - easeOutQuad(clamp01((t - half) / (this.phaseMs - half)))))
        : 0;
      this.dark = this.phase === 'exit'
        ? (t < half ? easeInCubic(clamp01(t / half)) * PEAK_DARK : PEAK_DARK * (1 - easeOutQuad(clamp01((t - half) / (this.phaseMs - half)))))
        : 0;
      return;
    }

    if (this.phase === 'enter') {
      this.bloom = t < 320
        ? 0
        : t < ASCENT_SWAP_MS
          ? easeInCubic(clamp01((t - 320) / (ASCENT_SWAP_MS - 320))) * PEAK_BLOOM
          : t < ASCENT_HOLD_MS
            ? PEAK_BLOOM
            : PEAK_BLOOM * (1 - easeOutQuad(clamp01((t - ASCENT_HOLD_MS) / (ASCENT_MS - ASCENT_HOLD_MS))));
      this.dark = 0;
      this.rays = t < 600
        ? 0
        : t < ASCENT_SWAP_MS
          ? easeOutCubic(clamp01((t - 600) / (ASCENT_SWAP_MS - 600))) * 0.85
          : t < ASCENT_HOLD_MS
            ? 0.85
            : lerp(0.85, AMBIENT_RAYS, easeOutQuad(clamp01((t - ASCENT_HOLD_MS) / (ASCENT_MS - ASCENT_HOLD_MS))));
      this.lift = t < 300
        ? -RISE_LIFT * (t / 300)
        : -RISE_LIFT * (1 - easeInOutCubic(clamp01((t - 300) / 1700)));
      this.fallScale = 1;
      return;
    }

    this.bloom = 0;
    this.dark = t < DESCENT_SWAP_MS
      ? easeInCubic(clamp01(t / DESCENT_SWAP_MS)) * PEAK_DARK
      : t < DESCENT_HOLD_MS
        ? PEAK_DARK
        : PEAK_DARK * (1 - easeOutQuad(clamp01((t - DESCENT_HOLD_MS) / (DESCENT_MS - DESCENT_HOLD_MS))));
    this.rays = AMBIENT_RAYS * (1 - clamp01(t / 500));
    this.lift = 0;
    this.fallScale = 1 + 0.7 * (1 - clamp01(t / 1400));
  },

  move(dt) {
    const h = this.h;
    const w = this.w;
    for (const p of this.particles) {
      p.y += (p.vy * this.fallScale + this.lift * (0.4 + p.d * 0.9)) * dt;
      p.x += p.vx * dt;
      if (p.star) p.rot += p.spin * dt;
      if (p.y - p.r > h + 30) {
        this.spawn(p, false);
      } else if (p.y + p.r < -140) {
        p.y = h + 20 + Math.random() * 60;
        p.x = Math.random() * w;
      }
      if (p.x < -40) p.x = w + 30;
      else if (p.x > w + 40) p.x = -30;
    }
  },

  paint() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    if (this.bloom > 0.002) {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.78);
      grad.addColorStop(0, `rgba(255, 253, 244, ${this.bloom})`);
      grad.addColorStop(0.55, `rgba(255, 236, 186, ${this.bloom * 0.94})`);
      grad.addColorStop(1, `rgba(255, 202, 108, ${this.bloom * 0.82})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.dark > 0.002) {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      grad.addColorStop(0, `rgba(44, 26, 4, ${this.dark * 0.92})`);
      grad.addColorStop(1, `rgba(12, 6, 0, ${this.dark})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.rays > 0.004 && this.sprites.rays) {
      const size = Math.max(w, h) * 2.1;
      ctx.globalCompositeOperation = 'lighter';
      this.sprites.rays.forEach((sprite, index) => {
        const spin = index ? -0.045 : 0.07;
        const scale = index ? 0.82 : 1;
        ctx.save();
        ctx.globalAlpha = this.rays * (index ? 0.55 : 1);
        ctx.translate(w * 0.5, h * 0.06);
        ctx.rotate(this.clock * spin);
        ctx.drawImage(sprite, (-size * scale) / 2, (-size * scale) / 2, size * scale, size * scale);
        ctx.restore();
      });
      ctx.globalCompositeOperation = 'source-over';
    }

    if (this.clouds.length && this.phase) {
      const span = this.phase === 'enter' ? ASCENT_CLOUD_MS : DESCENT_CLOUD_MS;
      const p = easeInOutCubic(clamp01(this.phaseT / span));
      const fade = clamp01(this.phaseT / 260) * (1 - clamp01((this.phaseT - span * 0.82) / (span * 0.45)));
      ctx.globalAlpha = 1;
      for (const cloud of this.clouds) {
        const scale = lerp(cloud.s0, cloud.s1, p) * (w / 360) * 0.78;
        const cw = 360 * scale;
        const ch = 200 * scale;
        const y = lerp(cloud.y0, cloud.y1, p) * h;
        ctx.save();
        ctx.globalAlpha = cloud.alpha * fade;
        ctx.translate(cloud.x * w, y);
        if (cloud.flip) ctx.scale(-1, 1);
        ctx.drawImage(cloud.sprite, -cw / 2, -ch / 2, cw, ch);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    if (this.fieldAlpha > 0.002) {
      const sprites = this.sprites;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.particles) {
        const wobble = 0.5 + 0.5 * Math.sin(this.clock * p.twinkle + p.twinklePhase);
        const alpha = p.alpha * (0.25 + 0.75 * Math.pow(wobble, p.star ? 3.4 : 2.2)) * this.fieldAlpha;
        if (alpha <= 0.005) continue;
        const x = p.x + Math.sin(this.clock * p.swaySpeed + p.swayPhase) * p.sway;
        ctx.globalAlpha = alpha;
        if (p.star) {
          const size = p.r * 4.4;
          ctx.save();
          ctx.translate(x, p.y);
          ctx.rotate(p.rot);
          ctx.drawImage(sprites.star, -size / 2, -size / 2, size, size);
          ctx.restore();
        } else {
          const glow = p.r * 3.2;
          ctx.drawImage(sprites.dots[p.tint], x - glow / 2, p.y - glow / 2, glow, glow);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  },
};

export default gold;
