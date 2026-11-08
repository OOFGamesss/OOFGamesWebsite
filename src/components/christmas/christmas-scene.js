import { artImage, element, randomBetween, replay } from './christmas-helpers.js';

const PRESENTS = [
  { art: 'present-1', modifier: 'back' },
  { art: 'present-2', modifier: 'middle' },
  { art: 'present-3', modifier: 'front' }
];

const SHOW_BAUBLES = false;
const SHOW_ROBINS = false;

const ROBINS = [
  { side: 'left', visitSeconds: 19, delaySeconds: 3 },
  { side: 'right', visitSeconds: 23, delaySeconds: 11 }
];

const ROBIN_COLUMNS_VW = { left: [2, 14], right: [74, 86] };
const ROBIN_ROWS_VH = [22, 60];
const ROBIN_CLICKABLE_OPACITY = 0.2;
const BAUBLE_REST_MS = [3500, 7000];

const SMALL_SCREEN_PX = 640;
const FLAKE_COUNT = 40;
const FLAKE_COUNT_SMALL = 18;
const FLAKE_SIZE_PX = [3, 8];
const FLAKE_FALL_SECONDS = [12, 26];
const FLAKE_DRIFT_VW = [-6, 6];
const FLAKE_OPACITY = [0.35, 0.85];

function buildPresent({ art, modifier }, { play, motionAllowed }) {
  const present = element('div', `xm-present xm-present--${modifier}`);
  const body = element('div', 'xm-present__body');
  body.appendChild(artImage(art, 'xm-present__img', present));
  present.append(element('div', 'xm-present__glow'), body);
  body.addEventListener('animationend', (event) => {
    if (event.target === body) present.classList.remove('is-wobbling');
  });
  present.addEventListener('click', () => {
    play('jingle');
    if (motionAllowed()) replay(present, 'is-wobbling');
  });
  return present;
}

function buildSnowman({ motionAllowed }) {
  const snowman = element('div', 'xm-snowman');
  const figure = element('div', 'xm-snowman__figure');
  figure.appendChild(artImage('snowman', 'xm-snowman__img', snowman));
  snowman.appendChild(figure);
  snowman.addEventListener('animationend', (event) => {
    if (event.target === snowman) snowman.classList.remove('is-shaking');
  });
  snowman.addEventListener('click', () => {
    if (motionAllowed()) replay(snowman, 'is-shaking');
  });
  return snowman;
}

function buildWreath() {
  const wreath = element('div', 'xm-wreath');
  wreath.append(element('div', 'xm-wreath__glow'), artImage('wreath', 'xm-wreath__img', wreath));
  return wreath;
}

function mountHero(header, effects) {
  const hero = element('div', 'xm-hero xm-root');
  hero.setAttribute('aria-hidden', 'true');
  const pile = element('div', 'xm-pile');
  const presents = PRESENTS.map((present) => buildPresent(present, effects));
  pile.append(...presents);
  hero.append(buildWreath(), buildSnowman(effects), pile);
  header.appendChild(hero);
  return presents;
}

function buildBauble(side, { motionAllowed }) {
  const bauble = element('div', `xm-bauble xm-bauble--${side}`);
  const body = element('div', 'xm-bauble__body');
  const img = artImage('bauble', 'xm-bauble__img', bauble);
  body.append(element('div', 'xm-bauble__ribbon'), img);
  bauble.appendChild(body);
  img.addEventListener('click', () => {
    if (!motionAllowed() || bauble.classList.contains('is-climbing')) return;
    bauble.classList.add('is-climbing');
    window.setTimeout(() => bauble.classList.remove('is-climbing'), randomBetween(...BAUBLE_REST_MS));
  });
  return bauble;
}

function mountCorners(effects) {
  const corners = element('div', 'xm-corners xm-root');
  corners.setAttribute('aria-hidden', 'true');
  for (const side of ['left', 'right']) {
    const holly = element('div', `xm-holly xm-holly--${side}`);
    holly.appendChild(artImage('holly', 'xm-holly__img', holly));
    corners.appendChild(holly);
    if (SHOW_BAUBLES) corners.appendChild(buildBauble(side, effects));
  }
  document.body.appendChild(corners);
}

function placeRobin(robin, side) {
  robin.style.left = `${randomBetween(...ROBIN_COLUMNS_VW[side]).toFixed(1)}vw`;
  robin.style.top = `${randomBetween(...ROBIN_ROWS_VH).toFixed(1)}vh`;
}

function buildRobin({ side, visitSeconds, delaySeconds }, { motionAllowed }) {
  const robin = element('div', `xm-robin xm-robin--${side}`);
  const img = artImage('robin', 'xm-robin__img', robin);
  robin.style.setProperty('--xm-visit', `${visitSeconds}s`);
  robin.style.setProperty('--xm-visit-delay', `${delaySeconds}s`);
  robin.appendChild(img);
  placeRobin(robin, side);

  robin.addEventListener('animationiteration', (event) => {
    if (event.target === robin) placeRobin(robin, side);
  });
  robin.addEventListener('animationend', (event) => {
    if (event.target !== robin) return;
    robin.classList.remove('is-flown');
    placeRobin(robin, side);
  });
  img.addEventListener('click', () => {
    if (!motionAllowed() || Number(getComputedStyle(robin).opacity) < ROBIN_CLICKABLE_OPACITY) return;
    robin.classList.add('is-flown');
  });
  return robin;
}

function buildFlake() {
  const flake = element('div', 'xm-flake');
  const fall = randomBetween(...FLAKE_FALL_SECONDS);
  flake.style.setProperty('--xm-flake-x', `${randomBetween(0, 100).toFixed(1)}vw`);
  flake.style.setProperty('--xm-flake-size', `${randomBetween(...FLAKE_SIZE_PX).toFixed(1)}px`);
  flake.style.setProperty('--xm-flake-fall', `${fall.toFixed(2)}s`);
  flake.style.setProperty('--xm-flake-delay', `${(-Math.random() * fall).toFixed(2)}s`);
  flake.style.setProperty('--xm-flake-drift', `${randomBetween(...FLAKE_DRIFT_VW).toFixed(1)}vw`);
  flake.style.setProperty('--xm-flake-opacity', randomBetween(...FLAKE_OPACITY).toFixed(2));
  return flake;
}

function buildSnow() {
  const snow = element('div', 'xm-snow');
  const count = window.innerWidth < SMALL_SCREEN_PX ? FLAKE_COUNT_SMALL : FLAKE_COUNT;
  for (let index = 0; index < count; index += 1) snow.appendChild(buildFlake());
  return snow;
}

function mountBackdrop(effects) {
  const backdrop = element('div', 'xm-backdrop xm-root');
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.appendChild(buildSnow());
  if (SHOW_ROBINS) for (const robin of ROBINS) backdrop.appendChild(buildRobin(robin, effects));
  for (const drift of ['east', 'west']) {
    const snowdrift = element('div', `xm-drift xm-drift--${drift}`);
    snowdrift.appendChild(artImage('snowdrift', 'xm-drift__img', snowdrift));
    backdrop.appendChild(snowdrift);
  }
  document.body.appendChild(backdrop);
}

export function mountScene(header, effects) {
  mountBackdrop(effects);
  const presents = mountHero(header, effects);
  mountCorners(effects);
  return { presents };
}
