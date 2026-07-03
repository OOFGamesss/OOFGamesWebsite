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
const LOBBY_FADE_MS = 3000;

const CLIPS = {
  theme: 'theme.mp3',
  lobby: 'lobby.mp3',
  win: 'win.mp3',
  horn: 'start-horn.mp3',
  kweh: 'kweh.mp3',
};

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
  onChange: null,

  ctx: null,
  gains: {},
  buffers: {},
  themeSource: null,
  lobbySource: null,
  winSource: null,
  lobbyOn: false,
  lobbyFadeRaf: null,

  init() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) this.ctx = new Ctx();

    for (const key of Object.keys(CLIPS)) {
      if (this.ctx) {
        const g = this.ctx.createGain();
        g.connect(this.ctx.destination);
        this.gains[key] = g;
      } else {
        this.gains[key] = null;
      }
    }

    this.applyVolumes();

    for (const [name, file] of Object.entries(CLIPS)) this.loadClip(name, file);

    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  },

  async loadClip(name, file) {
    if (!this.ctx) return;
    try {
      const resp = await fetch(`${AUDIO_BASE}/${file}`);
      const arr = await resp.arrayBuffer();
      this.buffers[name] = await this.decode(arr);
      if (name === 'theme') this.applyTheme();
      else if (name === 'lobby' && this.lobbyOn) this.resumeLobby();
    } catch {}
  },

  decode(arr) {
    return new Promise((resolve, reject) => {
      try {
        const p = this.ctx.decodeAudioData(arr, resolve, reject);
        if (p && p.then) p.then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  },

  unlock() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.unlocked) return;
    this.unlocked = true;
    this.applyTheme();
    if (this.lobbyOn) this.resumeLobby();
  },

  applyVolumes() {
    if (this.gains.theme) this.gains.theme.gain.value = THEME_BASE * this.musicVol;
    if (this.gains.lobby && this.lobbyFadeRaf === null) this.gains.lobby.gain.value = LOBBY_BASE * this.musicVol;
    if (this.gains.win) this.gains.win.gain.value = WIN_BASE * this.musicVol;
    if (this.gains.horn) this.gains.horn.gain.value = HORN_BASE * this.sfxVol;
    if (this.gains.kweh) this.gains.kweh.gain.value = KWEH_BASE * this.sfxVol;
  },

  playOne(name) {
    if (!this.ctx || !this.buffers[name]) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.connect(this.gains[name] || this.ctx.destination);
    try { src.start(0); } catch {}
    return src;
  },

  setBgm(on) {
    this.wantTheme = !!on;
    this.applyTheme();
  },

  startThemeSource(restart) {
    if (!this.ctx || !this.buffers.theme) return;
    if (this.themeSource && !restart) return;
    this.stopTheme();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.theme;
    src.loop = true;
    src.connect(this.gains.theme);
    try { src.start(0); } catch {}
    this.themeSource = src;
  },

  stopTheme() {
    if (this.themeSource) {
      try { this.themeSource.stop(); } catch {}
      this.themeSource = null;
    }
  },

  restartTheme() {
    if (this.themeSource) this.startThemeSource(true);
  },

  applyTheme() {
    const shouldPlay = this.wantTheme && this.musicOn && this.unlocked;
    if (shouldPlay) this.startThemeSource(false);
    else this.stopTheme();
  },

  setLobby(on) {
    on = !!on;
    if (on === this.lobbyOn) return;
    this.lobbyOn = on;
    if (on) this.startLobby();
    else this.fadeOutLobby();
  },

  startLobbySource() {
    if (!this.ctx || !this.buffers.lobby) return;
    this.stopLobby();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.lobby;
    src.loop = true;
    src.connect(this.gains.lobby);
    try { src.start(0); } catch {}
    this.lobbySource = src;
  },

  stopLobby() {
    if (this.lobbySource) {
      try { this.lobbySource.stop(); } catch {}
      this.lobbySource = null;
    }
  },

  startLobby() {
    this.cancelLobbyFade();
    if (this.gains.lobby) this.gains.lobby.gain.value = LOBBY_BASE * this.musicVol;
    if (this.musicOn && this.unlocked) this.startLobbySource();
  },

  resumeLobby() {
    this.cancelLobbyFade();
    if (this.gains.lobby) this.gains.lobby.gain.value = LOBBY_BASE * this.musicVol;
    if (this.musicOn && this.unlocked && this.lobbyOn) this.startLobbySource();
  },

  fadeOutLobby() {
    if (!this.gains.lobby) return;
    this.cancelLobbyFade();
    if (!this.lobbySource) { this.gains.lobby.gain.value = 0; return; }
    const startVol = this.gains.lobby.gain.value;
    const startTime = now();
    const step = () => {
      const t = (now() - startTime) / LOBBY_FADE_MS;
      if (t >= 1) {
        this.gains.lobby.gain.value = 0;
        this.stopLobby();
        this.lobbyFadeRaf = null;
        return;
      }
      this.gains.lobby.gain.value = startVol * (1 - t);
      this.lobbyFadeRaf = requestAnimationFrame(step);
    };
    this.lobbyFadeRaf = requestAnimationFrame(step);
  },

  cancelLobbyFade() {
    if (this.lobbyFadeRaf !== null) {
      cancelAnimationFrame(this.lobbyFadeRaf);
      this.lobbyFadeRaf = null;
    }
  },

  playWin() {
    if (!this.musicOn || !this.unlocked) return;
    this.stopTheme();
    this.winSource = this.playOne('win');
  },

  playHorn() {
    if (!this.sfxOn || !this.unlocked) return;
    this.playOne('horn');
  },

  playKweh() {
    if (!this.sfxOn || !this.unlocked) return;
    this.playOne('kweh');
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
      this.stopLobby();
      if (this.winSource) {
        try { this.winSource.stop(); } catch {}
        this.winSource = null;
      }
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
