const AUDIO_BASE = '/game-assets/chocobo-racing/audio';
const LS_MUSIC_ON = 'cr_music_on';
const LS_SFX_ON = 'cr_sfx_on';
const LS_MUSIC_VOL = 'cr_music_vol';
const LS_SFX_VOL = 'cr_sfx_vol';

const THEME_BASE = 0.5;
const WIN_BASE = 0.6;
const HORN_BASE = 0.8;
const KWEH_BASE = 0.7;
const MAX_KWEH_VOICES = 4;

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
  win: null,
  horn: null,
  kwehVoices: [],
  kwehSlot: 0,

  init() {
    this.theme = new Audio(`${AUDIO_BASE}/theme.mp3`);
    this.theme.loop = true;
    this.theme.preload = 'auto';

    this.win = new Audio(`${AUDIO_BASE}/win.mp3`);
    this.win.preload = 'auto';

    this.horn = new Audio(`${AUDIO_BASE}/start-horn.mp3`);
    this.horn.preload = 'auto';

    for (let i = 0; i < MAX_KWEH_VOICES; i++) {
      const a = new Audio(`${AUDIO_BASE}/kweh.mp3`);
      a.preload = 'auto';
      this.kwehVoices.push(a);
    }

    this.applyVolumes();

    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  },

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.applyTheme();
  },

  applyVolumes() {
    if (this.theme) this.theme.volume = THEME_BASE * this.musicVol;
    if (this.win) this.win.volume = WIN_BASE * this.musicVol;
    if (this.horn) this.horn.volume = HORN_BASE * this.sfxVol;
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

  applyTheme() {
    if (!this.theme) return;
    const shouldPlay = this.wantTheme && this.musicOn && this.unlocked;
    if (shouldPlay) {
      this.theme.play().catch(() => {});
    } else {
      this.theme.pause();
    }
  },

  playWin() {
    if (!this.musicOn || !this.unlocked || !this.win) return;
    if (this.theme) this.theme.pause();
    try {
      this.win.currentTime = 0;
      this.win.play().catch(() => {});
    } catch {}
  },

  playHorn() {
    if (!this.sfxOn || !this.unlocked || !this.horn) return;
    try {
      this.horn.currentTime = 0;
      this.horn.play().catch(() => {});
    } catch {}
  },

  playKweh() {
    if (!this.sfxOn || !this.unlocked || this.kwehVoices.length === 0) return;
    const a = this.kwehVoices[this.kwehSlot];
    this.kwehSlot = (this.kwehSlot + 1) % this.kwehVoices.length;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  },

  toggleMusic() {
    this.musicOn = !this.musicOn;
    save(LS_MUSIC_ON, this.musicOn ? '1' : '0');
    this.unlock();
    this.applyTheme();
    if (!this.musicOn && this.win) this.win.pause();
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
