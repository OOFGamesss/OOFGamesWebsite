const LS_QUALITY = 'oof_gfx';
const LS_BG_MOTION = 'oof_bg_motion';
const SS_TIER = 'oof_gfx_tier';

const TIER_RANK = { full: 2, reduced: 1, static: 0 };
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|basic render/i;

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

function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

const state = {
  quality: 'high',
  backgroundMotion: true,
  tier: 'full'
};

const explicit = {
  quality: false,
  backgroundMotion: false
};

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function rendererIsSoftware() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return SOFTWARE_RENDERER.test(renderer);
  } catch {
    return false;
  }
}

function weakDevice() {
  try {
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
  } catch {}
  return false;
}

function detectTier() {
  const cached = readSession(SS_TIER);
  if (cached && cached in TIER_RANK) return cached;
  let tier = 'full';
  if (prefersReducedMotion() || rendererIsSoftware()) tier = 'static';
  else if (weakDevice()) tier = 'reduced';
  writeSession(SS_TIER, tier);
  return tier;
}

function load() {
  const quality = read(LS_QUALITY);
  const motion = read(LS_BG_MOTION);
  explicit.quality = quality === 'low' || quality === 'high';
  explicit.backgroundMotion = motion === '1' || motion === '0';
  state.quality = explicit.quality ? quality : 'high';
  state.backgroundMotion = explicit.backgroundMotion ? motion === '1' : true;
  state.tier = detectTier();
}

function apply() {
  const root = document.documentElement;
  const settings = getSettings();
  root.dataset.gfx = settings.quality;
  root.dataset.bgMotion = settings.backgroundMotion ? 'on' : 'off';
  root.dataset.gfxTier = settings.tier;
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(getSettings());
    } catch {}
  }
}

export function getSettings() {
  const quality = !explicit.quality && state.tier !== 'full' ? 'low' : state.quality;
  const motionAllowed = explicit.backgroundMotion || state.tier !== 'static';
  return {
    quality,
    backgroundMotion: state.backgroundMotion && motionAllowed && !motionLocked(),
    tier: state.tier
  };
}

export function setQuality(quality) {
  const next = quality === 'low' ? 'low' : 'high';
  if (next === state.quality && explicit.quality) return;
  state.quality = next;
  explicit.quality = true;
  write(LS_QUALITY, next);
  apply();
  emit();
}

export function setBackgroundMotion(on) {
  const next = !!on;
  if (next === state.backgroundMotion && explicit.backgroundMotion) return;
  state.backgroundMotion = next;
  explicit.backgroundMotion = true;
  write(LS_BG_MOTION, next ? '1' : '0');
  apply();
  emit();
}

export function reportTier(tier) {
  if (!(tier in TIER_RANK)) return;
  if (TIER_RANK[tier] >= TIER_RANK[state.tier]) return;
  state.tier = tier;
  writeSession(SS_TIER, tier);
  apply();
  emit();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

load();
apply();
