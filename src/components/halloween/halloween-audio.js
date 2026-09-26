import { getAudioSettings, onAudioChange } from '../audio-settings.js';

const AUDIO_BASE = '/halloween/audio';
const MUSIC_TRACK = 'theme';
const MUSIC_VOLUME = 0.45;
const MUSIC_FADE_MS = 1600;

const SOUND_VOLUMES = {
  'evil-laugh': 0.8,
  'witch-cackle': 0.6
};

const UNLOCK_IGNORED = 'a, [data-oof-settings]';

function now() {
  return (typeof performance !== 'undefined' ? performance : Date).now();
}

function soundUrl(name) {
  return `${AUDIO_BASE}/${name}.mp3`;
}

function decode(ctx, data) {
  return new Promise((resolve, reject) => {
    const pending = ctx.decodeAudioData(data, resolve, reject);
    if (pending && pending.catch) pending.catch(reject);
  });
}

function ignoredTarget(target) {
  return target instanceof Element && target.closest(UNLOCK_IGNORED) !== null;
}

const audio = {
  get musicOn() { return getAudioSettings().musicOn; },
  get sfxOn() { return getAudioSettings().sfxOn; },
  get musicVol() { return getAudioSettings().musicVol; },
  get sfxVol() { return getAudioSettings().sfxVol; },

  unlocked: false,
  hidden: false,
  musicWas: null,
  retryArmed: false,

  music: null,
  musicBroken: false,
  musicMix: 0,
  fadeRaf: null,

  ctx: null,
  sfxGain: null,
  buffers: new Map(),
  playing: new Set(),

  init() {
    const unlock = (event) => {
      if (!this.unlocked && !ignoredTarget(event.target)) this.unlock();
    };
    window.addEventListener('click', unlock, true);
    window.addEventListener('keydown', unlock, true);
  },

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.musicWas = this.musicOn;
    this.ensureContext();
    if (this.sfxOn) {
      for (const name of Object.keys(SOUND_VOLUMES)) this.loadSound(name);
    }
    this.startMusic();
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
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxLevel();
    this.sfxGain.connect(ctx.destination);
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  },

  loadSound(name) {
    if (!this.buffers.has(name)) {
      const request = fetch(soundUrl(name))
        .then((response) => (response.ok ? response.arrayBuffer() : null))
        .then((data) => (data && this.ctx ? decode(this.ctx, data) : null))
        .catch(() => null);
      this.buffers.set(name, request);
    }
    return this.buffers.get(name);
  },

  play(name) {
    if (!(name in SOUND_VOLUMES) || !this.unlocked || this.hidden || !this.sfxOn) return;
    if (this.playing.has(name)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playing.add(name);
    this.loadSound(name).then((buffer) => {
      if (!buffer || this.hidden || !this.sfxOn) {
        this.playing.delete(name);
        return;
      }
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = SOUND_VOLUMES[name];
      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start();
      window.setTimeout(() => this.playing.delete(name), buffer.duration * 1000);
    });
  },

  sfxLevel() {
    return this.sfxOn ? this.sfxVol : 0;
  },

  applySfxVolume() {
    if (!this.ctx || !this.sfxGain) return;
    this.sfxGain.gain.setTargetAtTime(this.sfxLevel(), this.ctx.currentTime, 0.05);
  },

  musicLevel() {
    return Math.max(0, Math.min(1, MUSIC_VOLUME * this.musicVol * this.musicMix));
  },

  ensureMusic() {
    if (this.music) return this.music;
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.addEventListener('error', () => {
      this.musicBroken = true;
    });
    el.src = soundUrl(MUSIC_TRACK);
    this.music = el;
    return el;
  },

  startMusic() {
    if (!this.unlocked || this.hidden || !this.musicOn || this.musicBroken) return;
    const el = this.ensureMusic();
    if (el.paused) {
      const played = el.play();
      if (played && played.catch) played.catch(() => this.armRetry());
    }
    this.fadeMusic(1);
  },

  stopMusic() {
    if (this.music) this.fadeMusic(0);
  },

  fadeMusic(target) {
    const el = this.music;
    if (!el) return;
    if (this.fadeRaf !== null) cancelAnimationFrame(this.fadeRaf);
    const from = this.musicMix;
    const startedAt = now();
    const step = () => {
      const t = Math.min(1, (now() - startedAt) / MUSIC_FADE_MS);
      this.musicMix = from + (target - from) * t;
      el.volume = this.musicLevel();
      if (t < 1) {
        this.fadeRaf = requestAnimationFrame(step);
        return;
      }
      this.fadeRaf = null;
      if (target === 0) el.pause();
    };
    this.fadeRaf = requestAnimationFrame(step);
  },

  armRetry() {
    if (this.retryArmed) return;
    this.retryArmed = true;
    const retry = () => {
      if (!this.retryArmed) return;
      this.retryArmed = false;
      this.startMusic();
    };
    window.addEventListener('click', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
  },

  setHidden(hidden) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (!hidden) {
      this.startMusic();
      return;
    }
    if (this.fadeRaf !== null) cancelAnimationFrame(this.fadeRaf);
    this.fadeRaf = null;
    this.musicMix = 0;
    if (this.music) {
      this.music.volume = 0;
      this.music.pause();
    }
  },

  syncSettings() {
    this.unlock();
    const musicOn = this.musicOn;
    if (musicOn !== this.musicWas) {
      this.musicWas = musicOn;
      if (musicOn) this.startMusic();
      else this.stopMusic();
    }
    if (this.music) this.music.volume = this.musicLevel();
    this.applySfxVolume();
  }
};

onAudioChange(() => audio.syncSettings());

export default audio;
