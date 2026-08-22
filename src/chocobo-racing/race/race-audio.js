import { getAudioSettings, onAudioChange } from '../../components/audio-settings.js';

const AUDIO_BASE = '/game-assets/chocobo-racing/audio';

const THEME_BASE = 0.5;
const LOBBY_BASE = 0.25;
const WIN_BASE = 0.6;
const HORN_BASE = 0.8;
const KWEH_BASE = 0.7;
const MAX_KWEH_VOICES = 4;
const MAX_HORN_VOICES = 2;
const MAX_WIN_VOICES = 2;
const TRACK_BASE = { theme: THEME_BASE, lobby: LOBBY_BASE };
const TRACK_FADE_MS = 1200;
const INTRO_HOLD_MS = 900;

function now() {
  return (typeof performance !== 'undefined' ? performance : Date).now();
}

const audio = {
  get musicOn() { return getAudioSettings().musicOn; },
  get sfxOn() { return getAudioSettings().sfxOn; },
  get musicVol() { return getAudioSettings().musicVol; },
  get sfxVol() { return getAudioSettings().sfxVol; },
  unlocked: false,
  wantTheme: false,
  lobbyOn: false,
  musicWas: null,

  tracks: { theme: null, lobby: null },
  mix: { theme: 0, lobby: 0 },
  fadeRaf: { theme: null, lobby: null },
  activeTrack: null,
  introTimer: null,

  winVoices: [],
  winSlot: 0,
  hornVoices: [],
  hornSlot: 0,
  kwehVoices: [],
  kwehSlot: 0,

  init() {
    this.tracks.theme = new Audio(`${AUDIO_BASE}/theme.mp3`);
    this.tracks.theme.loop = true;
    this.tracks.theme.preload = 'auto';
    this.tracks.theme.volume = 0;

    this.tracks.lobby = new Audio(`${AUDIO_BASE}/lobby.mp3`);
    this.tracks.lobby.loop = true;
    this.tracks.lobby.preload = 'auto';
    this.tracks.lobby.volume = 0;

    this.winVoices = this.makeVoices(`${AUDIO_BASE}/win.mp3`, MAX_WIN_VOICES);
    this.hornVoices = this.makeVoices(`${AUDIO_BASE}/start-horn.mp3`, MAX_HORN_VOICES);
    this.kwehVoices = this.makeVoices(`${AUDIO_BASE}/kweh.mp3`, MAX_KWEH_VOICES);

    this.applyVoiceVolumes();

    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  },

  makeVoices(src, count) {
    const voices = [];
    for (let i = 0; i < count; i++) {
      const a = new Audio(src);
      a.preload = 'auto';
      a.addEventListener('ended', () => { try { a.currentTime = 0; } catch {} });
      voices.push(a);
    }
    return voices;
  },

  prime(el) {
    if (!el) return;
    const wasMuted = el.muted;
    const wasVolume = el.volume;
    el.muted = true;
    el.volume = 0;
    const restore = () => {
      el.pause();
      try { el.currentTime = 0; } catch {}
      el.muted = wasMuted;
      el.volume = wasVolume;
    };
    const p = el.play();
    if (p && p.then) p.then(restore).catch(restore);
    else restore();
  },

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    for (const a of this.winVoices) this.prime(a);
    for (const a of this.hornVoices) this.prime(a);
    for (const a of this.kwehVoices) this.prime(a);
    this.prime(this.tracks.lobby);

    this.setActiveTrack('theme');
    clearTimeout(this.introTimer);
    this.introTimer = setTimeout(() => this.reconcileTrack(), INTRO_HOLD_MS);
  },

  playVoice(voices, slotKey, gate) {
    if (!gate || !this.unlocked || voices.length === 0) return;
    const a = voices[this[slotKey]];
    this[slotKey] = (this[slotKey] + 1) % voices.length;
    try {
      if (a.currentTime !== 0) a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  },

  applyVoiceVolumes() {
    for (const a of this.winVoices) a.volume = WIN_BASE * this.musicVol;
    for (const a of this.hornVoices) a.volume = HORN_BASE * this.sfxVol;
    for (const a of this.kwehVoices) a.volume = KWEH_BASE * this.sfxVol;
  },

  applyTrackVolumes() {
    for (const name of Object.keys(this.tracks)) {
      const el = this.tracks[name];
      if (el) el.volume = TRACK_BASE[name] * this.musicVol * (this.mix[name] || 0);
    }
  },

  reconcileTrack() {
    const desired = this.wantTheme ? 'theme' : (this.lobbyOn ? 'lobby' : null);
    this.setActiveTrack(desired);
  },

  setActiveTrack(name) {
    if (name === this.activeTrack) { this.fadeIn(name); return; }
    const prev = this.activeTrack;
    this.activeTrack = name;
    if (prev) this.fadeOut(prev);
    if (name) this.fadeIn(name);
  },

  fadeIn(name) {
    if (!name) return;
    const el = this.tracks[name];
    if (!el) return;
    if (!this.unlocked || !this.musicOn) { this.cancelFade(name); this.mix[name] = 1; el.volume = 0; return; }
    if (!el.paused && this.mix[name] >= 1 && this.fadeRaf[name] == null) return;
    this.cancelFade(name);
    this.stopWin();
    if (el.paused) { try { el.currentTime = 0; } catch {} }
    el.play().catch(() => {});
    const startMix = this.mix[name] || 0;
    const startTime = now();
    const step = () => {
      const t = Math.min(1, (now() - startTime) / TRACK_FADE_MS);
      this.mix[name] = startMix + (1 - startMix) * t;
      el.volume = TRACK_BASE[name] * this.musicVol * this.mix[name];
      this.fadeRaf[name] = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.fadeRaf[name] = requestAnimationFrame(step);
  },

  fadeOut(name) {
    const el = this.tracks[name];
    if (!el) return;
    this.cancelFade(name);
    if (el.paused) { this.mix[name] = 0; el.volume = 0; return; }
    const startMix = this.mix[name] || 0;
    const startTime = now();
    const step = () => {
      const t = Math.min(1, (now() - startTime) / TRACK_FADE_MS);
      this.mix[name] = startMix * (1 - t);
      el.volume = TRACK_BASE[name] * this.musicVol * this.mix[name];
      if (t < 1) { this.fadeRaf[name] = requestAnimationFrame(step); return; }
      el.pause();
      this.fadeRaf[name] = null;
    };
    this.fadeRaf[name] = requestAnimationFrame(step);
  },

  cancelFade(name) {
    if (this.fadeRaf[name] != null) { cancelAnimationFrame(this.fadeRaf[name]); this.fadeRaf[name] = null; }
  },

  pauseTrack(name) {
    this.cancelFade(name);
    const el = this.tracks[name];
    if (el) el.pause();
    this.mix[name] = 0;
  },

  setBgm(on) {
    this.wantTheme = !!on;
    if (this.unlocked) this.reconcileTrack();
  },

  setLobby(on) {
    this.lobbyOn = !!on;
    if (this.unlocked) this.reconcileTrack();
  },

  restartTheme() {
    const el = this.tracks.theme;
    if (!el) return;
    try { el.currentTime = 0; } catch {}
  },

  stopWin() {
    for (const a of this.winVoices) {
      try { a.pause(); a.currentTime = 0; } catch {}
    }
  },

  playWin() {
    if (!this.musicOn || !this.unlocked) return;
    this.pauseTrack('theme');
    if (this.activeTrack === 'theme') this.activeTrack = null;
    this.playVoice(this.winVoices, 'winSlot', this.musicOn);
  },

  playHorn() {
    this.playVoice(this.hornVoices, 'hornSlot', this.sfxOn);
  },

  playKweh() {
    this.playVoice(this.kwehVoices, 'kwehSlot', this.sfxOn);
  },

  syncSettings() {
    this.unlock();
    const musicOn = this.musicOn;
    if (musicOn !== this.musicWas) {
      this.musicWas = musicOn;
      if (musicOn) {
        if (this.activeTrack) this.fadeIn(this.activeTrack);
      } else {
        this.pauseTrack('theme');
        this.pauseTrack('lobby');
        this.stopWin();
      }
    }
    this.applyTrackVolumes();
    this.applyVoiceVolumes();
  },
};

onAudioChange(() => audio.syncSettings());

export default audio;
