const LS_QUALITY = 'oof_gfx';
const LS_BG_MOTION = 'oof_bg_motion';

const GAME_PATHS = [
  '/chocobo-racing/race',
  '/lottery',
  '/mini-games-emporium/drt/bracket',
  '/venue-live',
];

export function motionLocked() {
  let path = '/';
  try {
    path = window.location.pathname;
  } catch {
    return false;
  }
  if (path === '/venue-live' || path === '/venue-live/') return false;
  return GAME_PATHS.some((game) => path === game || path.startsWith(`${game}/`));
}

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

const state = {
  quality: 'high',
  backgroundMotion: true
};

function load() {
  const quality = read(LS_QUALITY);
  const motion = read(LS_BG_MOTION);
  state.quality = quality === 'low' || quality === 'high' ? quality : 'high';
  state.backgroundMotion = motion === '1' || motion === '0' ? motion === '1' : true;
}

function apply() {
  const root = document.documentElement;
  root.dataset.gfx = state.quality;
  root.dataset.bgMotion = getSettings().backgroundMotion ? 'on' : 'off';
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(getSettings());
    } catch {}
  }
}

export function getSettings() {
  return {
    quality: state.quality,
    backgroundMotion: state.backgroundMotion && !motionLocked(),
  };
}

export function setQuality(quality) {
  const next = quality === 'low' ? 'low' : 'high';
  if (next === state.quality) return;
  state.quality = next;
  write(LS_QUALITY, next);
  apply();
  emit();
}

export function setBackgroundMotion(on) {
  const next = !!on;
  if (next === state.backgroundMotion) return;
  state.backgroundMotion = next;
  write(LS_BG_MOTION, next ? '1' : '0');
  apply();
  emit();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

load();
apply();
