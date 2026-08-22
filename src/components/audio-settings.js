const LS_MUSIC_ON = 'oof_music_on';
const LS_SFX_ON = 'oof_sfx_on';
const LS_MUSIC_VOL = 'oof_music_vol';
const LS_SFX_VOL = 'oof_sfx_vol';

const LEGACY_MUSIC_ON = ['cr_music_on', 'lot_music_on'];
const LEGACY_SFX_ON = ['cr_sfx_on', 'lot_sfx_on'];
const LEGACY_MUSIC_VOL = ['cr_music_vol', 'lot_music_vol'];
const LEGACY_SFX_VOL = ['cr_sfx_vol', 'lot_sfx_vol'];

const listeners = new Set();

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function readFirst(keys) {
  for (const key of keys) {
    const value = read(key);
    if (value !== null) return value;
  }
  return null;
}

function loadBool(key, legacy) {
  const value = read(key) ?? readFirst(legacy);
  return value === null ? true : value === '1';
}

function loadVolume(key, legacy) {
  const value = parseFloat(read(key) ?? readFirst(legacy));
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

const state = {
  musicOn: loadBool(LS_MUSIC_ON, LEGACY_MUSIC_ON),
  sfxOn: loadBool(LS_SFX_ON, LEGACY_SFX_ON),
  musicVol: loadVolume(LS_MUSIC_VOL, LEGACY_MUSIC_VOL),
  sfxVol: loadVolume(LS_SFX_VOL, LEGACY_SFX_VOL)
};

function emit() {
  for (const fn of listeners) {
    try {
      fn(getAudioSettings());
    } catch {}
  }
}

export function getAudioSettings() {
  return {
    musicOn: state.musicOn,
    sfxOn: state.sfxOn,
    musicVol: state.musicVol,
    sfxVol: state.sfxVol
  };
}

export function setMusicOn(on) {
  const next = !!on;
  if (next === state.musicOn) return;
  state.musicOn = next;
  write(LS_MUSIC_ON, next ? '1' : '0');
  emit();
}

export function setSfxOn(on) {
  const next = !!on;
  if (next === state.sfxOn) return;
  state.sfxOn = next;
  write(LS_SFX_ON, next ? '1' : '0');
  emit();
}

export function setMusicVolume(volume) {
  const next = Math.min(1, Math.max(0, Number(volume) || 0));
  if (next === state.musicVol) return;
  state.musicVol = next;
  write(LS_MUSIC_VOL, String(next));
  emit();
}

export function setSfxVolume(volume) {
  const next = Math.min(1, Math.max(0, Number(volume) || 0));
  if (next === state.sfxVol) return;
  state.sfxVol = next;
  write(LS_SFX_VOL, String(next));
  emit();
}

export function onAudioChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
