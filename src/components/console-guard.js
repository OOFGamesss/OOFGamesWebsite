const FLAG = 'oof-console-guard';
const HOME = '/';
const SUS_IMAGE = '/images/susdog.jpg';
const SIZE_THRESHOLD = 170;
const DEBUGGER_THRESHOLD = 120;

let armed = false;
let tripped = false;

function onHomePage() {
  const path = window.location.pathname;
  return path === '/' || path === '/index.html';
}

function trip() {
  if (tripped) {
    return;
  }
  tripped = true;
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch (error) {
    void error;
  }
  if (onHomePage()) {
    window.location.reload();
  } else {
    window.location.assign(HOME);
  }
}

function consoleOpenBySize() {
  const widthGap = window.outerWidth - window.innerWidth;
  const heightGap = window.outerHeight - window.innerHeight;
  return widthGap > SIZE_THRESHOLD || heightGap > SIZE_THRESHOLD;
}

function pollSize() {
  const open = consoleOpenBySize();
  if (!open) {
    armed = true;
    return;
  }
  if (armed) {
    trip();
  }
}

function pollDebugger() {
  const start = performance.now();
  debugger;
  if (performance.now() - start > DEBUGGER_THRESHOLD && armed) {
    trip();
  }
}

function handleKeydown(event) {
  const key = event.key;
  const isF12 = key === 'F12';
  const isInspect = (event.ctrlKey || event.metaKey) && event.shiftKey && ['I', 'J', 'C'].includes(key.toUpperCase());
  const isViewSource = (event.ctrlKey || event.metaKey) && key.toUpperCase() === 'U';
  if (isF12 || isInspect || isViewSource) {
    event.preventDefault();
    trip();
  }
}

function showSusModal() {
  let stored;
  try {
    stored = sessionStorage.getItem(FLAG);
    sessionStorage.removeItem(FLAG);
  } catch (error) {
    void error;
  }
  if (stored !== '1' || document.querySelector('[data-console-guard-modal]')) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.dataset.consoleGuardModal = 'true';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(2,6,23,0.85);backdrop-filter:blur(4px);';

  const card = document.createElement('div');
  card.style.cssText =
    'position:relative;max-width:90vw;max-height:90vh;border-radius:1rem;overflow:hidden;box-shadow:0 0 30px rgba(139,92,255,0.6),0 0 60px rgba(255,43,214,0.35);';

  const image = document.createElement('img');
  image.src = SUS_IMAGE;
  image.alt = 'Nice try.';
  image.style.cssText = 'display:block;max-width:90vw;max-height:80vh;object-fit:contain;';

  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '✕';
  close.style.cssText =
    'position:absolute;top:0.5rem;right:0.5rem;width:2.25rem;height:2.25rem;border:none;border-radius:9999px;cursor:pointer;font-size:1.1rem;font-weight:700;color:#fff;background:rgba(2,6,23,0.7);box-shadow:0 0 10px rgba(255,43,214,0.7);';
  close.addEventListener('click', () => overlay.remove());

  card.appendChild(image);
  card.appendChild(close);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function isDesktop() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
}

function start() {
  showSusModal();
  window.addEventListener('keydown', handleKeydown, true);
  if (!isDesktop()) {
    return;
  }
  pollSize();
  window.setInterval(pollSize, 500);
  window.setInterval(pollDebugger, 1000);
  window.addEventListener('contextmenu', (event) => event.preventDefault());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
