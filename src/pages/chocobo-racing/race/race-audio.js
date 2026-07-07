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
const LOBBY_FADE_MS = 3000;

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

const audio = {
  musicOn: loadBool(LS_MUSIC_ON, true),
  sfxOn: loadBool(LS_SFX_ON, true),
  musicVol: loadVol(LS_MUSIC_VOL),
  sfxVol: loadVol(LS_SFX_VOL),
  unlocked: false,
  wantTheme: false,
  onChange: null,

  theme: null,
  lobby: null,
  winVoices: [],
  winSlot: 0,
  hornVoices: [],
  hornSlot: 0,
  kwehVoices: [],
  kwehSlot: 0,
  lobbyOn: false,
  lobbyFadeTimer: null,

  init() {
    this.theme = new Audio(`${AUDIO_BASE}/theme.mp3`);
    this.theme.loop = true;
    this.theme.preload = 'auto';

    this.lobby = new Audio(`${AUDIO_BASE}/lobby.mp3`);
    this.lobby.loop = true;
    this.lobby.preload = 'auto';

    this.winVoices = this.makeVoices(`${AUDIO_BASE}/win.mp3`, MAX_WIN_VOICES);
    this.hornVoices = this.makeVoices(`${AUDIO_BASE}/start-horn.mp3`, MAX_HORN_VOICES);
    this.kwehVoices = this.makeVoices(`${AUDIO_BASE}/kweh.mp3`, MAX_KWEH_VOICES);

    this.applyVolumes();

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

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    const prime = (el) => {
      if (!el) return;
      const p = el.play();
      if (p && p.then) {
        p.then(() => { el.pause(); try { el.currentTime = 0; } catch {} }).catch(() => {});
      }
    };
    for (const a of this.winVoices) prime(a);
    for (const a of this.hornVoices) prime(a);
    for (const a of this.kwehVoices) prime(a);

    this.applyTheme();
    if (this.lobbyOn) this.resumeLobby();
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

  applyVolumes() {
    if (this.theme) this.theme.volume = THEME_BASE * this.musicVol;
    if (this.lobby && this.lobbyFadeTimer === null) this.lobby.volume = LOBBY_BASE * this.musicVol;
    for (const a of this.winVoices) a.volume = WIN_BASE * this.musicVol;
    for (const a of this.hornVoices) a.volume = HORN_BASE * this.sfxVol;
    for (const a of this.kwehVoices) a.volume = KWEH_BASE * this.sfxVol;
  },

  setBgm(on) {
    this.wantTheme = !!on;
    this.applyTheme();
  },

  restartTheme() {
    if (!this.theme) return;
    try { this.theme.currentTime = 0; } catch {}
  },

  stopWin() {
    for (const a of this.winVoices) {
      try { a.pause(); a.currentTime = 0; } catch {}
    }
  },

  applyTheme() {
    if (!this.theme) return;
    const shouldPlay = this.wantTheme && this.musicOn && this.unlocked;
    if (shouldPlay) {
      this.stopWin();
      this.theme.play().catch(() => {});
    } else {
      this.theme.pause();
    }
  },

  setLobby(on) {
    on = !!on;
    if (on === this.lobbyOn) return;
    this.lobbyOn = on;
    if (on) this.startLobby();
    else this.fadeOutLobby();
  },

  startLobby() {
    if (!this.lobby) return;
    this.cancelLobbyFade();
    this.stopWin();
    this.lobby.volume = LOBBY_BASE * this.musicVol;
    try { this.lobby.currentTime = 0; } catch {}
    if (this.musicOn && this.unlocked) this.lobby.play().catch(() => {});
  },

  resumeLobby() {
    if (!this.lobby) return;
    this.cancelLobbyFade();
    this.lobby.volume = LOBBY_BASE * this.musicVol;
    if (this.musicOn && this.unlocked && this.lobbyOn) this.lobby.play().catch(() => {});
  },

  fadeOutLobby() {
    if (!this.lobby) return;
    this.cancelLobbyFade();
    if (this.lobby.paused) { this.lobby.volume = 0; return; }
    const startVol = this.lobby.volume;
    const startTime = (typeof performance !== 'undefined' ? performance : Date).now();
    const step = () => {
      const t = ((typeof performance !== 'undefined' ? performance : Date).now() - startTime) / LOBBY_FADE_MS;
      if (t >= 1) {
        this.lobby.volume = 0;
        this.lobby.pause();
        this.lobbyFadeTimer = null;
        return;
      }
      this.lobby.volume = startVol * (1 - t);
      this.lobbyFadeTimer = requestAnimationFrame(step);
    };
    this.lobbyFadeTimer = requestAnimationFrame(step);
  },

  cancelLobbyFade() {
    if (this.lobbyFadeTimer !== null) {
      cancelAnimationFrame(this.lobbyFadeTimer);
      this.lobbyFadeTimer = null;
    }
  },

  playWin() {
    if (!this.musicOn || !this.unlocked) return;
    if (this.theme) this.theme.pause();
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
    this.applyTheme();
    if (this.musicOn) {
      if (this.lobbyOn) this.resumeLobby();
    } else {
      this.cancelLobbyFade();
      if (this.lobby) this.lobby.pause();
    }
    if (!this.musicOn) for (const a of this.winVoices) a.pause();
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
    this.applyVolumes();
    if (this.onChange) this.onChange();
  },

  setSfxVolume(v) {
    this.sfxVol = Math.min(1, Math.max(0, v));
    save(LS_SFX_VOL, String(this.sfxVol));
    this.unlock();
    this.applyVolumes();
    if (this.onChange) this.onChange();
  },
};

export default audio;
