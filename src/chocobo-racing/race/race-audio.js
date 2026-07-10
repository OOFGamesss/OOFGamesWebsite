const AUDIO_BASE = '/game-assets/chocobo-racing/audio';
const LS_MUSIC_ON = 'cr_music_on';
const LS_SFX_ON = 'cr_sfx_on';
const LS_MUSIC_VOL = 'cr_music_vol';
const LS_SFX_VOL = 'cr_sfx_vol';

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

function loadBool(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function loadVol(key) {
  try {
    const v = parseFloat(localStorage.getItem(key));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  } catch {
    return 1;
  }
}

function save(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function now() {
  return (typeof performance !== 'undefined' ? performance : Date).now();
}

const audio = {
  musicOn: loadBool(LS_MUSIC_ON, true),
  sfxOn: loadBool(LS_SFX_ON, true),
  musicVol: loadVol(LS_MUSIC_VOL),
  sfxVol: loadVol(LS_SFX_VOL),
  unlocked: false,
  wantTheme: false,
  lobbyOn: false,
  onChange: null,

  // Only one of these can ever be audible at a time - see setActiveTrack.
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

  // Plays + immediately pauses an element while muted, purely so browsers that
  // require every media element to have been started from within a genuine
  // user gesture (iOS Safari) will allow us to play it again later from
  // non-gesture code (websocket events, timers). Muted/zero-volume so nothing
  // is ever audibly triggered by this step, no matter how many clips exist.
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
    // Theme is about to be played for real below; lobby needs its own silent
    // priming so it's free to be swapped in later without another gesture.
    this.prime(this.tracks.lobby);

    // Greet with the theme, then let the real state (already known by the
    // time the player can click anything) decide what should actually keep
    // playing. Only one track is ever audible - see setActiveTrack.
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

  // wantTheme/lobbyOn are independent booleans set by race.js based on phase.
  // They can briefly both be true during fast state transitions - reconcile
  // picks a single winner (theme takes priority) instead of playing both.
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

  toggleMusic() {
    this.musicOn = !this.musicOn;
    save(LS_MUSIC_ON, this.musicOn ? '1' : '0');
    this.unlock();
    if (this.musicOn) {
      if (this.activeTrack) this.fadeIn(this.activeTrack);
    } else {
      this.pauseTrack('theme');
      this.pauseTrack('lobby');
      this.stopWin();
    }
    if (this.onChange) this.onChange();
  },

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    save(LS_SFX_ON, this.sfxOn ? '1' : '0');
    this.unlock();
    if (this.onChange) this.onChange();
  },

  setMusicVolume(v) {
    this.musicVol = Math.min(1, Math.max(0, v));
    save(LS_MUSIC_VOL, String(this.musicVol));
    this.unlock();
    this.applyTrackVolumes();
    this.applyVoiceVolumes();
    if (this.onChange) this.onChange();
  },

  setSfxVolume(v) {
    this.sfxVol = Math.min(1, Math.max(0, v));
    save(LS_SFX_VOL, String(this.sfxVol));
    this.unlock();
    this.applyVoiceVolumes();
    if (this.onChange) this.onChange();
  },
};

export default audio;
