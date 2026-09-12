import { getAudioSettings, onAudioChange } from '../../components/audio-settings.js';

const TRACKS = {
  theme: '/game-assets/ishgardian-vaults/audio/theme.mp3',
  bonus: '/game-assets/ishgardian-vaults/audio/bonus.mp3',
};

const THEME_BASE = 0.6;

const TRACK_GAIN = { theme: 1, bonus: 0.9 };
const THEME_FADE_MS = 700;
const SPIN_DUCK = 0.5;
const TRACK_SPIN_DUCK = { theme: 0.5, bonus: 0.5 };
const REVEAL_DUCK = 0.05;
const BONUS_REVEAL_DUCK = 0.22;
const DUCK_FADE_MS = 420;
const SFX_TRIM = 3.2;
const BED_TRIM = 1.1;
const TICK_GAP_MS = 45;
const HOVER_GAP_MS = 90;

const fadeInCurve = (t) => Math.sin((t * Math.PI) / 2);
const fadeOutCurve = (t) => 1 - Math.cos((t * Math.PI) / 2);

function now() {
  return (typeof performance !== 'undefined' ? performance : Date).now();
}

function makeNoiseBuffer(ctx) {
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function envelope(param, t0, attack, dur, peak) {
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  param.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

const audio = {
  get musicOn() { return getAudioSettings().musicOn; },
  get sfxOn() { return getAudioSettings().sfxOn; },
  get musicVol() { return getAudioSettings().musicVol; },
  get sfxVol() { return getAudioSettings().sfxVol; },
  unlocked: false,
  musicWas: null,

  ctx: null,
  sfxGain: null,
  bedGain: null,
  compressor: null,
  noise: null,
  rumbleBed: null,
  rollBed: null,

  running: new Set(),
  lastTick: 0,
  lastHover: 0,

  decks: [],
  active: 0,

  duckMix: 1,
  duckFrom: 1,
  duckTo: 1,
  duckAt: 0,
  duckMs: 0,
  duckRaf: null,

  themePrimed: false,
  themePriming: false,

  brokenTracks: new Set(),
  trackTimer: 0,
  retryArmed: false,
  duckTimer: null,
  duckHold: 0,
  lastRestart: 0,

  init() {
    if (this.decks.length) return;
    this.decks = [this.makeDeck('theme'), this.makeDeck(null)];
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  },

  makeDeck(name) {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    const deck = {
      el,
      name,
      src: '',
      mix: 0,
      from: 0,
      to: 0,
      at: 0,
      dur: 0,
      curve: null,
      pending: false,
      raf: null,
    };
    if (name && TRACKS[name]) {
      deck.src = TRACKS[name];
      el.src = TRACKS[name];
    }
    el.addEventListener('error', () => {
      if (deck.name) this.brokenTracks.add(deck.name);
    });
    el.addEventListener('ended', () => this.restartDeck(deck));
    el.addEventListener('pause', () => {
      if (deck.to > 0 && deck.mix > 0.001) this.resumeDeck(deck);
    });
    return deck;
  },

  unlock() {
    this.ensureContext();
    if (this.unlocked) return;
    this.unlocked = true;
    this.primeTheme();
  },

  primeTheme() {
    if (this.themePrimed) return;
    this.themePrimed = true;
    const ready = this.decks.filter((deck) => deck.el && deck.src);
    if (!ready.length) return;
    this.themePriming = true;
    let pending = ready.length;
    const done = () => {
      pending -= 1;
      if (pending > 0) return;
      this.themePriming = false;
      this.reconcileTheme();
    };
    for (const deck of ready) {
      const el = deck.el;
      el.muted = true;
      el.volume = 0;
      const restore = () => {
        el.pause();
        try {
          el.currentTime = 0;
        } catch {}
        el.muted = false;
        el.volume = 0;
        done();
      };
      const played = el.play();
      if (played && played.then) played.then(restore, restore);
      else restore();
    }
  },

  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.noise = makeNoiseBuffer(ctx);

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 20;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.compressor.connect(ctx.destination);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0;
    this.sfxGain.connect(this.compressor);

    this.bedGain = ctx.createGain();
    this.bedGain.gain.value = 0;
    this.bedGain.connect(this.compressor);

    this.rumbleBed = this.makeBed(140, 320, 40, 0.8);
    this.rollBed = this.makeBed(1450, 3200, 700, 1.5);

    this.applySfxVolume();
    this.applyBed();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  },

  makeBed(centre, lowpassHz, highpassHz, q) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = centre;
    band.Q.value = q;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = lowpassHz;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = highpassHz;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(band);
    band.connect(low);
    low.connect(high);
    high.connect(gain);
    gain.connect(this.bedGain);
    source.start();
    return gain;
  },

  applyBed() {
    if (!this.ctx || !this.rumbleBed) return;
    const count = this.running.size;
    const weight = count === 0 ? 0 : Math.min(1, Math.sqrt(count) / 2.2);
    const ramp = (node, value) => {
      node.gain.cancelScheduledValues(this.ctx.currentTime);
      node.gain.setTargetAtTime(value, this.ctx.currentTime, 0.14);
    };
    ramp(this.rumbleBed, 0.34 * weight);
    ramp(this.rollBed, 0.09 * weight);
  },

  noiseHit({ delay = 0, dur = 0.08, freq = 900, q = 1, gain = 0.2, type = 'bandpass', sweepTo = null, bus = null }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + dur);
    filter.Q.value = q;
    const node = ctx.createGain();
    envelope(node.gain, t0, Math.min(0.008, dur * 0.2), dur, gain);
    source.connect(filter);
    filter.connect(node);
    node.connect(bus || this.sfxGain);
    source.start(t0);
    source.stop(t0 + dur + 0.02);
  },

  tone({ delay = 0, dur = 0.3, freq = 440, to = null, type = 'sine', gain = 0.2, attack = 0.006 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    const node = ctx.createGain();
    envelope(node.gain, t0, attack, dur, gain);
    osc.connect(node);
    node.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  click() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.03, freq: 3200, q: 1.2, gain: 0.09, type: 'highpass' });
    this.tone({ dur: 0.05, freq: 1180, type: 'sine', gain: 0.06 });
  },

  stepper(direction) {
    if (!this.ctx) return;
    const base = direction > 0 ? 1380 : 940;
    this.noiseHit({ dur: 0.026, freq: 3600, q: 1.1, gain: 0.07, type: 'highpass' });
    this.tone({ dur: 0.055, freq: base, type: 'triangle', gain: 0.07 });
  },

  denied() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.07, freq: 260, q: 1.4, gain: 0.1 });
    this.tone({ dur: 0.11, freq: 150, to: 96, type: 'sine', gain: 0.09, attack: 0.012 });
  },

  hover() {
    if (!this.ctx || now() - this.lastHover < HOVER_GAP_MS) return;
    this.lastHover = now();
    this.noiseHit({ dur: 0.02, freq: 5200, q: 1.6, gain: 0.028, type: 'highpass' });
  },

  modalOpen() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.24, freq: 480, q: 0.8, gain: 0.07, sweepTo: 2200 });
    this.tone({ dur: 0.22, freq: 392, to: 587.33, type: 'triangle', gain: 0.08 });
  },

  modalClose() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.18, freq: 2000, q: 0.8, gain: 0.05, sweepTo: 420 });
    this.tone({ dur: 0.16, freq: 494, to: 330, type: 'triangle', gain: 0.06 });
  },

  vaultOpen() {
    if (!this.ctx) return;
    this.tone({ dur: 1.1, freq: 62, to: 38, type: 'sine', gain: 0.16, attack: 0.05 });
    this.noiseHit({ dur: 0.9, freq: 320, q: 0.7, gain: 0.09, sweepTo: 120 });
    this.noiseHit({ delay: 0.62, dur: 0.09, freq: 2400, q: 2.6, gain: 0.13, type: 'bandpass' });
    this.tone({ delay: 0.62, dur: 0.5, freq: 220, to: 110, type: 'triangle', gain: 0.09 });
  },

  spinStart() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.08, freq: 2600, q: 3, gain: 0.16, type: 'bandpass' });
    this.tone({ dur: 0.26, freq: 120, to: 52, type: 'sine', gain: 0.18, attack: 0.008 });
    this.noiseHit({ delay: 0.04, dur: 0.34, freq: 600, q: 0.9, gain: 0.1, sweepTo: 1800 });
  },

  reelStarted(key) {
    this.ensureContext();
    this.running.add(key);
    this.applyBed();
    this.reconcileTheme();
  },

  reelEnded(key) {
    if (!this.running.delete(key)) return;
    this.applyBed();
    this.reconcileTheme();
  },

  reset() {
    if (this.running.size === 0) return;
    this.running.clear();
    this.applyBed();
    this.reconcileTheme();
  },

  tick(tier, strength) {
    if (!this.ctx || !this.sfxOn) return;
    const stamp = now();
    if (stamp - this.lastTick < TICK_GAP_MS) return;
    this.lastTick = stamp;
    const share = 1 / Math.sqrt(Math.max(1, this.running.size));
    const level = (0.05 + 0.07 * Math.min(1, strength)) * share;
    const bright = tier >= 4 ? 1.35 : 1;
    this.noiseHit({ dur: 0.022, freq: (3000 + Math.random() * 900) * bright, q: 1.4, gain: level, type: 'highpass' });
    this.tone({ dur: 0.03, freq: (760 + Math.random() * 120) * bright, type: 'square', gain: level * 0.45 });
  },

  reelStop() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.1, freq: 900, q: 1.8, gain: 0.16, sweepTo: 260 });
    this.tone({ dur: 0.2, freq: 190, to: 70, type: 'triangle', gain: 0.16, attack: 0.004 });
  },

  rarity(tier) {
    if (!this.ctx) return;
    if (tier === 0) {
      this.tone({ delay: 0.05, dur: 0.2, freq: 174.61, to: 130.81, type: 'triangle', gain: 0.07 });
      this.noiseHit({ delay: 0.05, dur: 0.22, freq: 900, q: 1.4, gain: 0.05, sweepTo: 300 });
      return;
    }
    if (tier === 6) {
      [523.25, 698.46, 880].forEach((freq, index) => {
        this.tone({ delay: 0.04 + index * 0.075, dur: 0.3, freq, type: 'triangle', gain: 0.13 });
      });
      this.noiseHit({ delay: 0.05, dur: 0.5, freq: 5200, q: 0.8, gain: 0.05, type: 'highpass' });
      return;
    }
    const base = [349.23, 440, 523.25, 659.25, 880][Math.min(4, Math.max(0, tier - 1))];
    this.tone({ delay: 0.05, dur: 0.34, freq: base, type: 'triangle', gain: 0.09 + tier * 0.012 });
    this.tone({ delay: 0.05, dur: 0.2, freq: base * 2, type: 'sine', gain: 0.035 });
  },

  boxShake(tier, ms) {
    if (!this.ctx) return;
    const seconds = ms / 1000;
    const hits = Math.round(seconds * (13 + tier * 3));
    for (let index = 0; index < hits; index += 1) {
      const share = index / Math.max(1, hits - 1);
      const build = 0.3 + 0.7 * share;
      this.noiseHit({
        delay: share * seconds * 0.95 + Math.random() * 0.02,
        dur: 0.028 + Math.random() * 0.022,
        freq: 620 + Math.random() * 1100 * build,
        q: 2.4,
        gain: (0.035 + 0.075 * build) * (0.72 + tier * 0.08),
      });
    }
    this.tone({ dur: seconds, freq: 74, to: 50, type: 'sine', gain: 0.08, attack: seconds * 0.55 });
    if (tier >= 4) {
      this.tone({
        dur: seconds * 0.96,
        freq: 190,
        to: 780 + tier * 240,
        type: 'sawtooth',
        gain: 0.05,
        attack: seconds * 0.62,
      });
    }
  },

  boxOpen(tier) {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.17, freq: 2500, q: 1.1, gain: 0.2, sweepTo: 400 });
    this.tone({ dur: 0.32, freq: 156, to: 56, type: 'triangle', gain: 0.18 });
    this.noiseHit({ delay: 0.02, dur: 0.55, freq: 5400, q: 0.8, gain: 0.06, type: 'highpass' });
    this.reveal(tier);
  },

  openAll(tier, count) {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.2, freq: 2600, q: 1, gain: 0.22, sweepTo: 380 });
    this.tone({ dur: 0.4, freq: 172, to: 52, type: 'triangle', gain: 0.2 });
    for (let index = 0; index < count; index += 1) {
      this.noiseHit({
        delay: 0.03 + index * 0.045,
        dur: 0.09,
        freq: 1700 + Math.random() * 1100,
        q: 2,
        gain: 0.1,
      });
    }
    this.noiseHit({ delay: 0.04, dur: 0.75, freq: 5600, q: 0.8, gain: 0.07, type: 'highpass' });
    this.reveal(tier);
  },

  reveal(tier) {
    if (!this.ctx) return;
    if (tier === 6) {
      this.duckMusic(1.6, BONUS_REVEAL_DUCK);
      [523.25, 659.25, 880, 1046.5, 1318.5, 1760].forEach((freq, index) => {
        const delay = 0.03 + index * 0.085;
        this.tone({ delay, dur: 0.7, freq, type: 'triangle', gain: 0.17 });
        this.tone({ delay, dur: 0.3, freq: freq * 2, type: 'sine', gain: 0.05 });
      });
      this.noiseHit({ delay: 0.03, dur: 1.6, freq: 6600, q: 0.7, gain: 0.06, type: 'highpass' });
      return;
    }
    if (tier >= 5) {
      this.duckMusic(3.4);
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, index) => {
        const delay = 0.04 + index * 0.1;
        this.tone({ delay, dur: 0.85, freq, type: 'triangle', gain: 0.16 });
        this.tone({ delay, dur: 0.45, freq: freq * 2, type: 'sine', gain: 0.05 });
      });
      for (const freq of [523.25, 783.99, 1046.5]) {
        this.tone({ delay: 0.58, dur: 1.7, freq, type: 'triangle', gain: 0.11 });
      }
      this.noiseHit({ delay: 0.04, dur: 1.5, freq: 6200, q: 0.7, gain: 0.05, type: 'highpass' });
      return;
    }
    if (tier === 4) {
      this.duckMusic(1.8);
      [659.25, 880, 1174.66].forEach((freq, index) => {
        this.tone({ delay: 0.04 + index * 0.1, dur: 0.62, freq, type: 'triangle', gain: 0.15 });
        this.tone({ delay: 0.04 + index * 0.1, dur: 0.34, freq: freq * 2, type: 'sine', gain: 0.045 });
      });
      this.noiseHit({ delay: 0.06, dur: 0.7, freq: 5400, q: 0.8, gain: 0.04, type: 'highpass' });
      return;
    }
    if (tier === 3) {
      this.tone({ delay: 0.04, dur: 0.42, freq: 587.33, to: 880, type: 'triangle', gain: 0.14 });
      this.tone({ delay: 0.1, dur: 0.3, freq: 1174.66, type: 'sine', gain: 0.05 });
      return;
    }
    if (tier === 2) {
      this.tone({ delay: 0.04, dur: 0.36, freq: 587.33, type: 'triangle', gain: 0.12 });
      this.tone({ delay: 0.04, dur: 0.2, freq: 1174.66, type: 'sine', gain: 0.04 });
      return;
    }
    this.tone({ delay: 0.04, dur: 0.26, freq: 349.23, type: 'triangle', gain: 0.1 });
    this.tone({ delay: 0.14, dur: 0.34, freq: 293.66, type: 'triangle', gain: 0.08 });
  },

  bonusStart() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 1.1, freq: 900, q: 0.6, gain: 0.12, sweepTo: 5200, type: 'bandpass' });
    [261.63, 392, 523.25, 783.99].forEach((freq, index) => {
      this.tone({ delay: index * 0.06, dur: 1.5, freq, type: 'triangle', gain: 0.11, attack: 0.05 });
    });
  },

  bonusEnd() {
    if (!this.ctx) return;
    this.tone({ dur: 0.9, freq: 523.25, to: 261.63, type: 'triangle', gain: 0.1, attack: 0.03 });
    this.noiseHit({ delay: 0.1, dur: 0.8, freq: 3200, q: 0.8, gain: 0.06, sweepTo: 600 });
  },

  spinsDone() {
    if (!this.ctx) return;
    this.tone({ dur: 0.5, freq: 220, to: 110, type: 'triangle', gain: 0.11, attack: 0.02 });
    this.noiseHit({ delay: 0.24, dur: 0.5, freq: 420, q: 0.9, gain: 0.07, sweepTo: 140 });
  },

  error() {
    if (!this.ctx) return;
    this.tone({ dur: 0.22, freq: 233.08, type: 'sawtooth', gain: 0.08 });
    this.tone({ delay: 0.13, dur: 0.3, freq: 174.61, type: 'sawtooth', gain: 0.07 });
  },

  activeDeck() {
    return this.decks[this.active] || null;
  },

  idleDeck() {
    return this.decks[1 - this.active] || null;
  },

  deckBroken(deck) {
    return !deck || !deck.name || !deck.src || this.brokenTracks.has(deck.name);
  },

  deckVolume(deck) {
    const level = THEME_BASE * (TRACK_GAIN[deck.name] || 1) * this.musicVol * deck.mix * this.duckMix;
    return Math.max(0, Math.min(1, level));
  },

  applyDeckVolumes() {
    for (const deck of this.decks) {
      if (deck.el) deck.el.volume = this.deckVolume(deck);
    }
  },

  themeWanted() {
    return this.unlocked && this.musicOn && !this.themePriming;
  },

  reconcileTheme() {
    const deck = this.activeDeck();
    if (!deck) return;
    if (!this.themeWanted()) {
      for (const each of this.decks) this.setDeckTarget(each, 0, THEME_FADE_MS, fadeOutCurve);
      this.setDuck(1, 0);
      return;
    }
    if (this.deckBroken(deck)) {
      this.setDeckTarget(deck, 0, THEME_FADE_MS, fadeOutCurve);
      this.setDuck(1, 0);
      return;
    }
    if (!deck.pending) this.setDeckTarget(deck, 1, THEME_FADE_MS, fadeInCurve);
    if (this.duckHold > now()) return;
    const duck = TRACK_SPIN_DUCK[deck.name];
    const wanted = this.running.size > 0 ? (duck === undefined ? SPIN_DUCK : duck) : 1;
    this.setDuck(wanted, DUCK_FADE_MS);
  },

  setDeckTarget(deck, target, ms = THEME_FADE_MS, curve = null) {
    const el = deck && deck.el;
    if (!el || this.deckBroken(deck)) return;
    if (target > 0 && !this.themeWanted()) return;
    if (target === deck.to) {
      if (deck.raf === null) {
        el.volume = this.deckVolume(deck);
        if (target === 0 && !el.paused) el.pause();
      }
      return;
    }
    deck.to = target;
    deck.from = deck.mix;
    deck.at = now();
    deck.dur = Math.max(1, ms);
    deck.curve = curve;

    if (target > 0 && el.paused) {
      const played = el.play();
      if (played && played.catch) played.catch(() => this.armRetry());
    }

    if (deck.raf !== null) cancelAnimationFrame(deck.raf);
    const step = () => {
      const t = Math.min(1, (now() - deck.at) / deck.dur);
      const shaped = deck.curve ? deck.curve(t) : t;
      deck.mix = deck.from + (deck.to - deck.from) * shaped;
      el.volume = this.deckVolume(deck);
      if (t < 1) {
        deck.raf = requestAnimationFrame(step);
        return;
      }
      deck.raf = null;
      deck.mix = deck.to;
      el.volume = this.deckVolume(deck);
      if (deck.mix <= 0.001 && !el.paused) el.pause();
    };
    deck.raf = requestAnimationFrame(step);
  },

  setDuck(target, ms) {
    if (target === this.duckTo) {
      if (this.duckRaf === null) {
        this.duckMix = target;
        this.applyDeckVolumes();
      }
      return;
    }
    if (this.duckRaf !== null) cancelAnimationFrame(this.duckRaf);
    this.duckTo = target;
    this.duckFrom = this.duckMix;
    this.duckAt = now();
    this.duckMs = ms;
    if (!(ms > 0)) {
      this.duckMix = target;
      this.duckRaf = null;
      this.applyDeckVolumes();
      return;
    }
    const step = () => {
      const t = Math.min(1, (now() - this.duckAt) / this.duckMs);
      this.duckMix = this.duckFrom + (this.duckTo - this.duckFrom) * t;
      this.applyDeckVolumes();
      if (t < 1) {
        this.duckRaf = requestAnimationFrame(step);
        return;
      }
      this.duckRaf = null;
      this.duckMix = this.duckTo;
      this.applyDeckVolumes();
    };
    this.duckRaf = requestAnimationFrame(step);
  },

  preloadTrack(name) {
    if (!TRACKS[name] || this.brokenTracks.has(name) || !this.decks.length) return;
    const deck = this.idleDeck();
    if (!deck || !deck.el || deck.src === TRACKS[name]) return;
    if (deck.raf !== null) {
      cancelAnimationFrame(deck.raf);
      deck.raf = null;
    }
    deck.name = name;
    deck.src = TRACKS[name];
    deck.mix = 0;
    deck.from = 0;
    deck.to = 0;
    deck.pending = false;
    deck.el.volume = 0;
    try {
      deck.el.pause();
    } catch {}
    deck.el.src = TRACKS[name];
    try {
      deck.el.load();
    } catch {}
  },

  setTrack(name, options = {}) {
    if (!TRACKS[name] || !this.decks.length) return;
    if (this.brokenTracks.has(name)) return;
    const current = this.activeDeck();
    if (!current || current.name === name) return;
    const next = this.idleDeck();
    if (!next || !next.el) return;

    const out = options.out === undefined ? THEME_FADE_MS : options.out;
    const inMs = options.in === undefined ? THEME_FADE_MS : options.in;
    const delay = options.delay === undefined ? 0 : options.delay;

    window.clearTimeout(this.trackTimer);
    current.pending = false;
    next.pending = false;

    this.setDeckTarget(current, 0, out, fadeOutCurve);

    if (next.src !== TRACKS[name]) {
      if (next.raf !== null) {
        cancelAnimationFrame(next.raf);
        next.raf = null;
      }
      next.src = TRACKS[name];
      next.mix = 0;
      next.from = 0;
      next.to = 0;
      next.el.volume = 0;
      try {
        next.el.pause();
      } catch {}
      next.el.src = TRACKS[name];
    }
    next.name = name;
    if (next.el.paused || next.mix <= 0.001) {
      try {
        next.el.currentTime = 0;
      } catch {}
    }
    this.active = 1 - this.active;

    const start = () => {
      if (this.activeDeck() !== next) return;
      next.pending = false;
      this.setDeckTarget(next, 1, inMs, fadeInCurve);
      this.reconcileTheme();
    };

    if (delay > 0) {
      next.pending = true;
      this.trackTimer = window.setTimeout(start, delay);
      this.reconcileTheme();
      return;
    }
    start();
  },

  restartDeck(deck) {
    if (!deck || !deck.el || this.deckBroken(deck) || this.themePriming) return;
    if (deck !== this.activeDeck() || !this.themeWanted()) return;
    if (now() - this.lastRestart < 400) return;
    this.lastRestart = now();
    deck.el.loop = true;
    try {
      deck.el.currentTime = 0;
    } catch {}
    deck.el.volume = this.deckVolume(deck);
    const played = deck.el.play();
    if (played && played.catch) played.catch(() => this.armRetry());
  },

  resumeDeck(deck) {
    if (!deck || !deck.el || this.deckBroken(deck) || this.themePriming) return;
    if (!this.themeWanted() || !deck.el.paused) return;
    if (now() - this.lastRestart < 400) return;
    this.lastRestart = now();
    deck.el.loop = true;
    deck.el.volume = this.deckVolume(deck);
    const played = deck.el.play();
    if (played && played.catch) played.catch(() => this.armRetry());
  },

  armRetry() {
    if (this.retryArmed) return;
    this.retryArmed = true;
    const retry = () => {
      this.retryArmed = false;
      this.reconcileTheme();
    };
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
  },

  duckMusic(seconds, level = REVEAL_DUCK) {
    clearTimeout(this.duckTimer);
    this.duckHold = now() + seconds * 1000;
    this.setDuck(level, DUCK_FADE_MS);
    this.duckTimer = setTimeout(() => {
      this.duckHold = 0;
      this.reconcileTheme();
    }, seconds * 1000);
  },

  applySfxVolume() {
    if (!this.sfxGain || !this.ctx) return;
    const level = this.sfxOn ? this.sfxVol : 0;
    this.sfxGain.gain.setTargetAtTime(level * SFX_TRIM, this.ctx.currentTime, 0.05);
    this.bedGain.gain.setTargetAtTime(level * BED_TRIM, this.ctx.currentTime, 0.05);
  },

  syncSettings() {
    this.unlock();
    const musicOn = this.musicOn;
    if (musicOn !== this.musicWas) {
      this.musicWas = musicOn;
      this.reconcileTheme();
    } else {
      this.applyDeckVolumes();
    }
    this.applySfxVolume();
  }
};

onAudioChange(() => audio.syncSettings());

export default audio;
