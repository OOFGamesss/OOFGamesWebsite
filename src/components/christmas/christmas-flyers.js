import { artImage, artUrl, element, randomBetween } from './christmas-helpers.js';

const SMALL_SCREEN_PX = 640;

const SANTA_FIRST_MS = [8000, 12000];
const SANTA_GAP_MS = [25000, 45000];
const SANTA_SIZE_PX = [260, 340];
const SANTA_SIZE_SMALL_PX = [170, 210];
const SANTA_FLY_SECONDS = [10, 13];
const SANTA_FLY_SMALL_SECONDS = [7, 9];
const SANTA_BAND_VH = [38, 48];
const HO_HO_DELAY_MS = 2700;

const OFFSCREEN_START = 'calc(-100% - 2vw)';
const OFFSCREEN_END = '102vw';

function isSmallScreen() {
  return window.innerWidth < SMALL_SCREEN_PX;
}

function buildSanta() {
  const small = isSmallScreen();
  const direction = Math.random() < 0.5 ? 1 : -1;
  const santa = element('div', 'xm-santa');
  santa.style.setProperty('--xm-size', `${Math.round(randomBetween(...(small ? SANTA_SIZE_SMALL_PX : SANTA_SIZE_PX)))}px`);
  santa.style.setProperty('--xm-y', `${randomBetween(...SANTA_BAND_VH).toFixed(1)}vh`);
  santa.style.setProperty('--xm-from', direction > 0 ? OFFSCREEN_START : OFFSCREEN_END);
  santa.style.setProperty('--xm-to', direction > 0 ? OFFSCREEN_END : OFFSCREEN_START);
  santa.style.setProperty('--xm-fly', `${randomBetween(...(small ? SANTA_FLY_SMALL_SECONDS : SANTA_FLY_SECONDS)).toFixed(2)}s`);
  santa.style.setProperty('--xm-dir', String(direction));
  santa.addEventListener('animationend', (event) => {
    if (event.target === santa) santa.remove();
  });
  const arc = element('div', 'xm-santa__arc');
  arc.appendChild(artImage('santa', 'xm-santa__img', santa));
  santa.appendChild(arc);
  return santa;
}

export function createFlyers(play) {
  const layer = element('div', 'xm-flyers xm-root');
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  let santaMissing = false;
  const probe = new Image();
  probe.addEventListener('error', () => {
    santaMissing = true;
  }, { once: true });
  probe.src = artUrl('santa');

  let santaTimer = 0;
  let running = false;

  const spawnSanta = () => {
    if (santaMissing || layer.querySelector('.xm-santa')) return;
    const santa = buildSanta();
    layer.appendChild(santa);
    window.setTimeout(() => {
      if (santa.isConnected) play('ho-ho-ho');
    }, HO_HO_DELAY_MS);
  };

  const scheduleSanta = (wait) => {
    santaTimer = window.setTimeout(() => {
      spawnSanta();
      scheduleSanta(randomBetween(...SANTA_GAP_MS));
    }, wait);
  };

  const start = () => {
    if (running) return;
    running = true;
    scheduleSanta(randomBetween(...SANTA_FIRST_MS));
  };

  const stop = () => {
    running = false;
    window.clearTimeout(santaTimer);
  };

  return {
    update(motion, hidden) {
      if (!motion) {
        stop();
        layer.replaceChildren();
        return;
      }
      if (hidden) stop();
      else start();
    }
  };
}
