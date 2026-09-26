import { artImage, element, randomBetween, replay } from './halloween-helpers.js';

const PUMPKINS = [
  { art: 'pumpkin-1', modifier: 'back' },
  { art: 'pumpkin-2', modifier: 'front' }
];

const GHOSTS = [
  { side: 'left', hauntSeconds: 19, delaySeconds: 3 },
  { side: 'right', hauntSeconds: 23, delaySeconds: 11 }
];

const GHOST_COLUMNS_VW = { left: [2, 14], right: [74, 86] };
const GHOST_ROWS_VH = [22, 60];
const GHOST_CLICKABLE_OPACITY = 0.2;
const SPIDER_REST_MS = [3500, 7000];

function buildPumpkin({ art, modifier }, { play, motionAllowed }) {
  const pumpkin = element('div', `hw-pumpkin hw-pumpkin--${modifier}`);
  const body = element('div', 'hw-pumpkin__body');
  body.append(artImage(art, 'hw-pumpkin__img', pumpkin), artImage(`${art}-glow`, 'hw-pumpkin__face'));
  pumpkin.append(element('div', 'hw-pumpkin__glow'), body);
  body.addEventListener('animationend', (event) => {
    if (event.target === body) pumpkin.classList.remove('is-wobbling');
  });
  pumpkin.addEventListener('click', () => {
    play('evil-laugh');
    if (motionAllowed()) replay(pumpkin, 'is-wobbling');
  });
  return pumpkin;
}

function buildScarecrow({ motionAllowed }) {
  const scarecrow = element('div', 'hw-scarecrow');
  const figure = element('div', 'hw-scarecrow__figure');
  figure.append(artImage('scarecrow', 'hw-scarecrow__img', scarecrow), artImage('scarecrow-glow', 'hw-scarecrow__face'));
  scarecrow.appendChild(figure);
  scarecrow.addEventListener('animationend', (event) => {
    if (event.target === scarecrow) scarecrow.classList.remove('is-shaking');
  });
  scarecrow.addEventListener('click', () => {
    if (motionAllowed()) replay(scarecrow, 'is-shaking');
  });
  return scarecrow;
}

function buildMoon() {
  const moon = element('div', 'hw-moon');
  moon.append(element('div', 'hw-moon__glow'), artImage('moon', 'hw-moon__img', moon));
  return moon;
}

function mountHero(header, effects) {
  const hero = element('div', 'hw-hero hw-root');
  hero.setAttribute('aria-hidden', 'true');
  const patch = element('div', 'hw-patch');
  const pumpkins = PUMPKINS.map((pumpkin) => buildPumpkin(pumpkin, effects));
  patch.append(...pumpkins);
  hero.append(buildMoon(), buildScarecrow(effects), patch);
  header.appendChild(hero);
  return pumpkins;
}

function buildSpider(side, { motionAllowed }) {
  const spider = element('div', `hw-spider hw-spider--${side}`);
  const body = element('div', 'hw-spider__body');
  const img = artImage('spider', 'hw-spider__img', spider);
  body.append(element('div', 'hw-spider__thread'), img);
  spider.appendChild(body);
  img.addEventListener('click', () => {
    if (!motionAllowed() || spider.classList.contains('is-climbing')) return;
    spider.classList.add('is-climbing');
    window.setTimeout(() => spider.classList.remove('is-climbing'), randomBetween(...SPIDER_REST_MS));
  });
  return spider;
}

function mountWebs(effects) {
  const webs = element('div', 'hw-webs hw-root');
  webs.setAttribute('aria-hidden', 'true');
  for (const side of ['left', 'right']) {
    const web = element('div', `hw-web hw-web--${side}`);
    web.appendChild(artImage('cobweb', 'hw-web__img', web));
    webs.append(web, buildSpider(side, effects));
  }
  document.body.appendChild(webs);
}

function placeGhost(ghost, side) {
  ghost.style.left = `${randomBetween(...GHOST_COLUMNS_VW[side]).toFixed(1)}vw`;
  ghost.style.top = `${randomBetween(...GHOST_ROWS_VH).toFixed(1)}vh`;
}

function buildGhost({ side, hauntSeconds, delaySeconds }, { motionAllowed }) {
  const ghost = element('div', `hw-ghost hw-ghost--${side}`);
  const img = artImage('ghost', 'hw-ghost__img', ghost);
  ghost.style.setProperty('--hw-haunt', `${hauntSeconds}s`);
  ghost.style.setProperty('--hw-haunt-delay', `${delaySeconds}s`);
  ghost.appendChild(img);
  placeGhost(ghost, side);

  ghost.addEventListener('animationiteration', (event) => {
    if (event.target === ghost) placeGhost(ghost, side);
  });
  ghost.addEventListener('animationend', (event) => {
    if (event.target !== ghost) return;
    ghost.classList.remove('is-banished');
    placeGhost(ghost, side);
  });
  img.addEventListener('click', () => {
    if (!motionAllowed() || Number(getComputedStyle(ghost).opacity) < GHOST_CLICKABLE_OPACITY) return;
    ghost.classList.add('is-banished');
  });
  return ghost;
}

function mountBackdrop(effects) {
  const backdrop = element('div', 'hw-backdrop hw-root');
  backdrop.setAttribute('aria-hidden', 'true');
  for (const ghost of GHOSTS) backdrop.appendChild(buildGhost(ghost, effects));
  for (const drift of ['east', 'west']) {
    const fog = element('div', `hw-fog hw-fog--${drift}`);
    fog.appendChild(artImage('fog', 'hw-fog__img', fog));
    backdrop.appendChild(fog);
  }
  document.body.appendChild(backdrop);
}

export function mountScene(header, effects) {
  mountBackdrop(effects);
  const pumpkins = mountHero(header, effects);
  mountWebs(effects);
  return { pumpkins };
}
