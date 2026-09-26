import { artImage, artUrl, element, randomBetween } from './halloween-helpers.js';

const SMALL_SCREEN_PX = 640;

const WITCH_FIRST_MS = [8000, 12000];
const WITCH_GAP_MS = [25000, 45000];
const WITCH_SIZE_PX = [150, 190];
const WITCH_SIZE_SMALL_PX = [100, 120];
const WITCH_FLY_SECONDS = [10, 13];
const WITCH_FLY_SMALL_SECONDS = [7, 9];
const WITCH_BAND_VH = [38, 48];
const CACKLE_DELAY_MS = 1200;

const OFFSCREEN_START = 'calc(-100% - 2vw)';
const OFFSCREEN_END = '102vw';

function isSmallScreen() {
  return window.innerWidth < SMALL_SCREEN_PX;
}

function buildWitch() {
  const small = isSmallScreen();
  const direction = Math.random() < 0.5 ? 1 : -1;
  const witch = element('div', 'hw-witch');
  witch.style.setProperty('--hw-size', `${Math.round(randomBetween(...(small ? WITCH_SIZE_SMALL_PX : WITCH_SIZE_PX)))}px`);
  witch.style.setProperty('--hw-y', `${randomBetween(...WITCH_BAND_VH).toFixed(1)}vh`);
  witch.style.setProperty('--hw-from', direction > 0 ? OFFSCREEN_START : OFFSCREEN_END);
  witch.style.setProperty('--hw-to', direction > 0 ? OFFSCREEN_END : OFFSCREEN_START);
  witch.style.setProperty('--hw-fly', `${randomBetween(...(small ? WITCH_FLY_SMALL_SECONDS : WITCH_FLY_SECONDS)).toFixed(2)}s`);
  witch.style.setProperty('--hw-dir', String(direction));
  witch.addEventListener('animationend', (event) => {
    if (event.target === witch) witch.remove();
  });
  const arc = element('div', 'hw-witch__arc');
  arc.appendChild(artImage('witch', 'hw-witch__img', witch));
  witch.appendChild(arc);
  return witch;
}

export function createFlyers(play) {
  const layer = element('div', 'hw-flyers hw-root');
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  let witchMissing = false;
  const probe = new Image();
  probe.addEventListener('error', () => {
    witchMissing = true;
  }, { once: true });
  probe.src = artUrl('witch');

  let witchTimer = 0;
  let running = false;

  const spawnWitch = () => {
    if (witchMissing || layer.querySelector('.hw-witch')) return;
    const witch = buildWitch();
    layer.appendChild(witch);
    window.setTimeout(() => {
      if (witch.isConnected) play('witch-cackle');
    }, CACKLE_DELAY_MS);
  };

  const scheduleWitch = (wait) => {
    witchTimer = window.setTimeout(() => {
      spawnWitch();
      scheduleWitch(randomBetween(...WITCH_GAP_MS));
    }, wait);
  };

  const start = () => {
    if (running) return;
    running = true;
    scheduleWitch(randomBetween(...WITCH_FIRST_MS));
  };

  const stop = () => {
    running = false;
    window.clearTimeout(witchTimer);
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
