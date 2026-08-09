const THEME_SRC = '/game-assets/lottery/audio/theme.mp3';
const LS_MUSIC_ON = 'lot_music_on';
const LS_SFX_ON = 'lot_sfx_on';
const LS_MUSIC_VOL = 'lot_music_vol';
const LS_SFX_VOL = 'lot_sfx_vol';

const THEME_BASE = 0.7;
const THEME_FADE_MS = 1400;
const WAITING_BED_DUCK = 0.42;
const RATTLE_MS = 110;
const MACHINE_TAIL_MS = 2200;
const SFX_TRIM = 3.2;
const BED_TRIM = 1.1;
const LOCK_RATIOS = [1, 1.1225, 1.2599, 1.4142];

function loadBool(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

function loadVol(key) {
  try {
    const value = parseFloat(localStorage.getItem(key));
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
  } catch {
    return 0.5;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

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
  musicOn: loadBool(LS_MUSIC_ON, true),
  sfxOn: loadBool(LS_SFX_ON, true),
  musicVol: loadVol(LS_MUSIC_VOL),
  sfxVol: loadVol(LS_SFX_VOL),
  unlocked: false,
  onChange: null,

  ctx: null,
  sfxGain: null,
  bedGain: null,
  compressor: null,
  primed: false,
  priming: false,
  noise: null,
  blowerGain: null,
  rollGain: null,
  rattleTimer: null,
  riser: null,

  phase: null,
  machineBusy: false,
  busyTimer: null,
  tumbleLevel: 0,
  tumbleCount: 0,
  intakeOn: false,

  themeEl: null,
  themeMix: 0,
  themeRaf: null,
  themeWanted: false,
  themeBroken: false,
  retryArmed: false,
  ducked: false,
  duckTimer: null,
  lastRestart: 0,

  init() {
    this.themeEl = new Audio(THEME_SRC);
    this.themeEl.loop = true;
    this.themeEl.preload = 'auto';
    this.themeEl.volume = 0;
    this.themeEl.addEventListener('error', () => {
      this.themeBroken = true;
    });
    this.themeEl.addEventListener('ended', () => this.restartTheme());
    this.themeEl.addEventListener('pause', () => {
      if (this.themeWanted && !this.ducked && !this.priming && this.themeMix > 0) this.restartTheme();
    });
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  },

  unlock() {
    this.ensureContext();
    if (this.unlocked) return;
    this.unlocked = true;
    this.primeTheme();
  },

  primeTheme() {
    const el = this.themeEl;
    if (!el || this.primed) return;
    this.primed = true;
    this.priming = true;
    el.muted = true;
    el.volume = 0;
    const restore = () => {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {}
      el.muted = false;
      el.volume = 0;
      this.priming = false;
      if (this.themeWanted) this.fadeThemeIn();
    };
    const played = el.play();
    if (played && played.then) played.then(restore, restore);
    else restore();
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

    this.blowerGain = this.makeBed(620, 1500, 180, 0.9);
    this.rollGain = this.makeBed(1750, 3600, 900, 1.6);

    this.applySfxVolume();
    clearInterval(this.rattleTimer);
    this.rattleTimer = setInterval(() => this.rattle(), RATTLE_MS);
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

  bedScale() {
    return this.phase === 'drawing' || this.machineBusy ? 1 : WAITING_BED_DUCK;
  },

  applyBed() {
    if (!this.ctx) return;
    const scale = this.bedScale();
    const density = Math.min(1, this.tumbleCount / 9);
    const blower = this.tumbleCount === 0
      ? 0
      : Math.min(0.42, 0.05 + this.tumbleLevel * 0.12) * density * scale;
    const ramp = (node, value) => {
      node.gain.cancelScheduledValues(this.ctx.currentTime);
      node.gain.setTargetAtTime(value, this.ctx.currentTime, 0.18);
    };
    ramp(this.blowerGain, blower);
    ramp(this.rollGain, this.intakeOn ? 0.05 * scale : 0);
  },

  rattle() {
    if (!this.ctx || this.tumbleCount === 0 || !this.sfxOn) return;
    const density = Math.min(1, this.tumbleCount / 8);
    const rate = (1.4 + this.tumbleLevel * 6) * density;
    const expected = rate * (RATTLE_MS / 1000);
    let count = Math.floor(expected);
    if (Math.random() < expected - count) count += 1;
    for (let i = 0; i < count; i += 1) {
      this.noiseHit({
        delay: Math.random() * (RATTLE_MS / 1000),
        dur: 0.035,
        freq: 1100 + Math.random() * 1600,
        q: 3,
        gain: (0.05 + Math.random() * 0.12) * this.bedScale(),
        bus: this.bedGain
      });
    }
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
    if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
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

  setPhase(phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.reconcileTheme();
  },

  setMachineBusy(active) {
    clearTimeout(this.busyTimer);
    if (active) {
      if (this.machineBusy) return;
      this.machineBusy = true;
      this.reconcileTheme();
      return;
    }
    if (!this.machineBusy) return;
    this.busyTimer = setTimeout(() => {
      this.machineBusy = false;
      this.reconcileTheme();
    }, MACHINE_TAIL_MS);
  },

  reconcileTheme() {
    const wanted = this.phase !== 'drawing' && !this.machineBusy;
    this.applyBed();
    if (wanted === this.themeWanted) return;
    this.themeWanted = wanted;
    if (wanted) this.fadeThemeIn();
    else this.fadeThemeOut();
  },

  setTumble(level, count) {
    this.tumbleLevel = level;
    this.tumbleCount = count;
    this.applyBed();
  },

  setIntake(on) {
    this.intakeOn = Boolean(on);
    this.applyBed();
  },

  ballIn() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.09, freq: 420, q: 1.2, gain: 0.16 });
    this.tone({ dur: 0.1, freq: 150, to: 62, type: 'sine', gain: 0.14 });
  },

  capture() {
    if (!this.ctx) return;
    this.stopRiser();
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const dur = 2.2;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(300, t0 + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, t0);
    filter.frequency.exponentialRampToValueAtTime(2600, t0 + dur);
    filter.Q.value = 6;
    const node = ctx.createGain();
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(0.09, t0 + dur * 0.85);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filter);
    filter.connect(node);
    node.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    this.riser = { osc, node };
  },

  stopRiser() {
    if (!this.riser || !this.ctx) return;
    const { osc, node } = this.riser;
    this.riser = null;
    const t0 = this.ctx.currentTime;
    try {
      node.gain.cancelScheduledValues(t0);
      node.gain.setValueAtTime(Math.max(0.0002, node.gain.value), t0);
      node.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      osc.stop(t0 + 0.18);
    } catch {}
  },

  chute() {
    if (!this.ctx) return;
    this.stopRiser();
    this.noiseHit({ dur: 0.13, freq: 560, q: 0.9, gain: 0.22, sweepTo: 180 });
    this.tone({ dur: 0.14, freq: 240, to: 74, type: 'triangle', gain: 0.18 });
  },

  tray() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.5, freq: 820, q: 2.2, gain: 0.09, sweepTo: 1500 });
  },

  lock(slot, bonus) {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.05, freq: 2600, q: 1.6, gain: 0.18, type: 'highpass' });
    if (bonus) {
      const notes = [880, 1108.7, 1318.5, 1760];
      notes.forEach((freq, index) => {
        this.tone({ delay: 0.06 + index * 0.085, dur: 0.5, freq, type: 'triangle', gain: 0.16 });
        this.tone({ delay: 0.06 + index * 0.085, dur: 0.3, freq: freq * 2, type: 'sine', gain: 0.05 });
      });
      this.noiseHit({ delay: 0.06, dur: 0.6, freq: 5200, q: 0.8, gain: 0.05, type: 'highpass' });
      return;
    }
    const base = 587.33 * (LOCK_RATIOS[slot] ?? 1);
    this.tone({ delay: 0.02, dur: 0.6, freq: base, type: 'triangle', gain: 0.16 });
    this.tone({ delay: 0.02, dur: 0.4, freq: base * 2, type: 'sine', gain: 0.06 });
    this.tone({ delay: 0.02, dur: 0.22, freq: base * 3.01, type: 'sine', gain: 0.025 });
  },

  gap() {
    if (!this.ctx) return;
    this.tone({ dur: 0.2, freq: 78, to: 48, type: 'sine', gain: 0.1, attack: 0.02 });
    this.tone({ delay: 0.34, dur: 0.24, freq: 66, to: 42, type: 'sine', gain: 0.08, attack: 0.02 });
  },

  hit(count) {
    if (!this.ctx) return;
    const freq = 660 * 1.26 ** Math.max(0, count - 1);
    this.tone({ delay: 0.3, dur: 0.26, freq: freq * 0.75, to: freq, type: 'triangle', gain: 0.16 });
    this.tone({ delay: 0.34, dur: 0.3, freq: freq * 1.5, type: 'sine', gain: 0.07 });
  },

  jackpot() {
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, index) => {
      const delay = index * 0.13;
      this.tone({ delay, dur: 0.9, freq, type: 'triangle', gain: 0.17 });
      this.tone({ delay, dur: 0.5, freq: freq * 2, type: 'sine', gain: 0.06 });
    });
    for (const freq of [523.25, 659.25, 783.99, 1046.5]) {
      this.tone({ delay: 0.72, dur: 1.8, freq, type: 'triangle', gain: 0.12 });
    }
    this.noiseHit({ delay: 0.72, dur: 1.6, freq: 6000, q: 0.7, gain: 0.05, type: 'highpass' });
  },

  win() {
    if (!this.ctx) return;
    [659.25, 880, 1046.5].forEach((freq, index) => {
      this.tone({ delay: index * 0.11, dur: 0.6, freq, type: 'triangle', gain: 0.16 });
      this.tone({ delay: index * 0.11, dur: 0.34, freq: freq * 2, type: 'sine', gain: 0.05 });
    });
  },

  noWin() {
    if (!this.ctx) return;
    this.tone({ dur: 0.42, freq: 392, type: 'triangle', gain: 0.1 });
    this.tone({ delay: 0.16, dur: 0.6, freq: 311.13, type: 'triangle', gain: 0.09 });
  },

  click() {
    if (!this.ctx) return;
    this.noiseHit({ dur: 0.03, freq: 3200, q: 1.2, gain: 0.09, type: 'highpass' });
    this.tone({ dur: 0.05, freq: 1180, type: 'sine', gain: 0.06 });
  },

  shuffle() {
    if (!this.ctx) return;
    for (let i = 0; i < 8; i += 1) {
      this.noiseHit({
        delay: i * 0.055 + Math.random() * 0.015,
        dur: 0.04,
        freq: 1400 + Math.random() * 2200,
        q: 2.4,
        gain: 0.07
      });
    }
    this.tone({ delay: 0.44, dur: 0.22, freq: 784, type: 'triangle', gain: 0.1 });
  },

  purchase() {
    if (!this.ctx) return;
    this.tone({ dur: 0.7, freq: 1046.5, type: 'triangle', gain: 0.16 });
    this.tone({ delay: 0.07, dur: 0.8, freq: 1568, type: 'triangle', gain: 0.14 });
    this.tone({ delay: 0.07, dur: 0.5, freq: 2093, type: 'sine', gain: 0.05 });
    this.noiseHit({ delay: 0.02, dur: 0.4, freq: 5400, q: 0.9, gain: 0.05, type: 'highpass' });
  },

  restartTheme() {
    const el = this.themeEl;
    if (!el || this.themeBroken || this.priming || this.ducked) return;
    if (!this.themeWanted || !this.musicOn || !this.unlocked) return;
    if (now() - this.lastRestart < 400) return;
    this.lastRestart = now();
    el.loop = true;
    try {
      el.currentTime = 0;
    } catch {}
    el.volume = THEME_BASE * this.musicVol * this.themeMix;
    const played = el.play();
    if (played && played.catch) played.catch(() => this.armRetry());
  },

  fadeThemeIn() {
    const el = this.themeEl;
    if (!el || this.themeBroken || this.priming || this.ducked) return;
    if (!this.unlocked || !this.musicOn) return;
    if (el.preload !== 'auto') el.preload = 'auto';
    el.loop = true;
    this.cancelThemeFade();
    if (el.paused) {
      try {
        el.currentTime = 0;
      } catch {}
      const played = el.play();
      if (played && played.catch) played.catch(() => this.armRetry());
    }
    const startMix = this.themeMix;
    const startTime = now();
    const step = () => {
      const t = Math.min(1, (now() - startTime) / THEME_FADE_MS);
      this.themeMix = startMix + (1 - startMix) * t;
      el.volume = THEME_BASE * this.musicVol * this.themeMix;
      this.themeRaf = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.themeRaf = requestAnimationFrame(step);
  },

  fadeThemeOut() {
    const el = this.themeEl;
    if (!el) return;
    this.cancelThemeFade();
    if (el.paused) {
      this.themeMix = 0;
      el.volume = 0;
      return;
    }
    const startMix = this.themeMix;
    const startTime = now();
    const step = () => {
      const t = Math.min(1, (now() - startTime) / THEME_FADE_MS);
      this.themeMix = startMix * (1 - t);
      el.volume = THEME_BASE * this.musicVol * this.themeMix;
      if (t < 1) {
        this.themeRaf = requestAnimationFrame(step);
        return;
      }
      el.pause();
      this.themeRaf = null;
    };
    this.themeRaf = requestAnimationFrame(step);
  },

  cancelThemeFade() {
    if (this.themeRaf !== null) {
      cancelAnimationFrame(this.themeRaf);
      this.themeRaf = null;
    }
  },

  armRetry() {
    if (this.retryArmed) return;
    this.retryArmed = true;
    const retry = () => {
      this.retryArmed = false;
      if (this.themeWanted) this.fadeThemeIn();
    };
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
  },

  duckMusic(seconds) {
    clearTimeout(this.duckTimer);
    this.ducked = true;
    this.fadeThemeOut();
    this.duckTimer = setTimeout(() => {
      this.ducked = false;
      if (this.themeWanted) this.fadeThemeIn();
    }, seconds * 1000);
  },

  applySfxVolume() {
    if (!this.sfxGain || !this.ctx) return;
    const level = this.sfxOn ? this.sfxVol : 0;
    this.sfxGain.gain.setTargetAtTime(level * SFX_TRIM, this.ctx.currentTime, 0.05);
    this.bedGain.gain.setTargetAtTime(level * BED_TRIM, this.ctx.currentTime, 0.05);
  },

  toggleMusic() {
    this.musicOn = !this.musicOn;
    save(LS_MUSIC_ON, this.musicOn ? '1' : '0');
    this.unlock();
    if (this.musicOn && this.themeWanted) this.fadeThemeIn();
    if (!this.musicOn) {
      this.cancelThemeFade();
      this.themeMix = 0;
      if (this.themeEl) {
        this.themeEl.volume = 0;
        this.themeEl.pause();
      }
    }
    if (this.onChange) this.onChange();
  },

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    save(LS_SFX_ON, this.sfxOn ? '1' : '0');
    this.unlock();
    this.applySfxVolume();
    if (this.onChange) this.onChange();
  },

  setMusicVolume(value) {
    this.musicVol = Math.min(1, Math.max(0, value));
    save(LS_MUSIC_VOL, String(this.musicVol));
    this.unlock();
    if (this.themeEl) this.themeEl.volume = THEME_BASE * this.musicVol * this.themeMix;
    if (this.onChange) this.onChange();
  },

  setSfxVolume(value) {
    this.sfxVol = Math.min(1, Math.max(0, value));
    save(LS_SFX_VOL, String(this.sfxVol));
    this.unlock();
    this.applySfxVolume();
    if (this.onChange) this.onChange();
  }
};

export default audio;
