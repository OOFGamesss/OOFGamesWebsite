import { element, randomBetween, replay } from './halloween-helpers.js';

const FIRST_CHATTER_MS = [4000, 7000];
const CHATTER_GAP_MS = [9000, 16000];
const TEASE_MS = 3600;
const REACTION_MS = 2200;
const GAP_PX = 10;
const EDGE_PX = 8;
const TAIL_INSET_PX = 16;
const VISIBLE_OPACITY = 0.5;

const TEASES = {
  pumpkin: [
    'Don’t you dare poke me!',
    'Hands off my pumpkin patch!',
    'I bite, you know.',
    'Whatever you do, don’t click me.',
    'Touch me and see what happens…'
  ],
  scarecrow: [
    'No touching, I’m ticklish!',
    'Keep your hands to yourself!',
    'I’m stuffed. Please don’t poke.',
    'Don’t even think about it.'
  ],
  spider: [
    'Eek! Keep your fingers away!',
    'Don’t touch my thread!',
    'I’m more scared of you than you are of me.',
    'One poke and I’m out of here.'
  ],
  ghost: [
    'Boo! Don’t touch me!',
    'Your hand would go right through me.',
    'Hands off, I’m very fragile.',
    'Go on, I dare you.'
  ]
};

const REACTIONS = {
  pumpkin: ['Mwahaha!', 'I told you not to touch me!', 'Rude!', 'That tickles!'],
  scarecrow: ['Oi! Watch the straw!', 'Hey, that tickles!', 'Now you’ve scared off the crows.'],
  spider: ['Eek! I’m off!', 'Not the face!', 'Nope, nope, nope!'],
  ghost: ['Poof!', 'Boo! Gone!', 'You’ll never catch me!']
};

const SIDE_ORDER = {
  pumpkin: ['above', 'left', 'right', 'below'],
  scarecrow: ['above', 'left', 'right', 'below'],
  spider: ['below', 'right', 'left', 'above'],
  ghost: ['above', 'below', 'right', 'left']
};

const FOCUS = {
  pumpkin: [0.5, 0.2],
  scarecrow: [0.5, 0.12],
  spider: [0.5, 0.45],
  ghost: [0.5, 0.25]
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function pick(list, avoid) {
  const options = list.length > 1 ? list.filter((item) => item !== avoid) : list;
  return options[Math.floor(Math.random() * options.length)];
}

function faded(host) {
  return Boolean(host) && Number(getComputedStyle(host).opacity) < VISIBLE_OPACITY;
}

function focusPoint(kind, rect) {
  const [x, y] = FOCUS[kind];
  return { x: rect.left + rect.width * x, y: rect.top + rect.height * y };
}

function spotFor(side, rect, point, size) {
  if (side === 'above') return { left: point.x - size.width / 2, top: rect.top - GAP_PX - size.height };
  if (side === 'below') return { left: point.x - size.width / 2, top: rect.bottom + GAP_PX };
  if (side === 'left') return { left: rect.left - GAP_PX - size.width, top: point.y - size.height / 2 };
  return { left: rect.right + GAP_PX, top: point.y - size.height / 2 };
}

function fits(side, spot, size) {
  if (side === 'above') return spot.top >= EDGE_PX;
  if (side === 'below') return spot.top + size.height <= window.innerHeight - EDGE_PX;
  if (side === 'left') return spot.left >= EDGE_PX;
  return spot.left + size.width <= window.innerWidth - EDGE_PX;
}

export function createSpeech() {
  const layer = element('div', 'hw-speech hw-root');
  layer.setAttribute('aria-hidden', 'true');
  const bubble = element('div', 'hw-bubble');
  layer.appendChild(bubble);
  document.body.appendChild(layer);

  const speakers = [];
  const lastLines = new Map();
  let current = null;
  let lastSpeaker = null;
  let side = 'above';
  let size = { width: 0, height: 0 };
  let followRaf = 0;
  let hideTimer = 0;
  let chatterTimer = 0;
  let running = false;

  const pickLine = (lines, key) => {
    const chosen = pick(lines, lastLines.get(key));
    lastLines.set(key, chosen);
    return chosen;
  };

  const onScreen = (speaker) => {
    if (!speaker.anchor.isConnected || faded(speaker.host)) return false;
    const rect = speaker.anchor.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Boolean(hit) && speaker.area.contains(hit);
  };

  const move = () => {
    if (!current || !current.anchor.isConnected) return false;
    if (faded(current.host)) return true;
    const rect = current.anchor.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return false;
    const point = focusPoint(current.kind, rect);
    const spot = spotFor(side, rect, point, size);
    const left = clamp(spot.left, EDGE_PX, window.innerWidth - size.width - EDGE_PX);
    const top = clamp(spot.top, EDGE_PX, window.innerHeight - size.height - EDGE_PX);
    const tail = side === 'above' || side === 'below'
      ? clamp(point.x - left, TAIL_INSET_PX, size.width - TAIL_INSET_PX)
      : clamp(point.y - top, TAIL_INSET_PX, size.height - TAIL_INSET_PX);
    bubble.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
    bubble.style.setProperty('--hw-tail', `${Math.round(tail)}px`);
    return true;
  };

  const hide = () => {
    window.clearTimeout(hideTimer);
    cancelAnimationFrame(followRaf);
    current = null;
    bubble.classList.remove('is-open');
  };

  const follow = () => {
    if (!move()) {
      hide();
      return;
    }
    followRaf = requestAnimationFrame(follow);
  };

  const chooseSide = (speaker) => {
    const rect = speaker.anchor.getBoundingClientRect();
    const point = focusPoint(speaker.kind, rect);
    const order = SIDE_ORDER[speaker.kind];
    return order.find((name) => fits(name, spotFor(name, rect, point, size), size)) || order[0];
  };

  const show = (speaker, text, duration) => {
    bubble.textContent = text;
    bubble.style.rotate = `${randomBetween(-3, 3).toFixed(1)}deg`;
    size = { width: bubble.offsetWidth, height: bubble.offsetHeight };
    side = chooseSide(speaker);
    bubble.dataset.side = side;
    current = speaker;
    cancelAnimationFrame(followRaf);
    if (!move()) {
      hide();
      return;
    }
    replay(bubble, 'is-open');
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, duration);
    followRaf = requestAnimationFrame(follow);
  };

  const schedule = (wait) => {
    window.clearTimeout(chatterTimer);
    chatterTimer = window.setTimeout(chatter, wait);
  };

  const chatter = () => {
    if (!current) {
      const available = speakers.filter(onScreen);
      if (available.length) {
        const speaker = pick(available, lastSpeaker);
        lastSpeaker = speaker;
        show(speaker, pickLine(TEASES[speaker.kind], `tease-${speaker.kind}`), TEASE_MS);
      }
    }
    schedule(randomBetween(...CHATTER_GAP_MS));
  };

  return {
    register(kind, anchor, area, host = null) {
      speakers.push({ kind, anchor, area, host });
    },
    react(anchor) {
      if (!running) return;
      const speaker = speakers.find((entry) => entry.anchor === anchor);
      if (!speaker) return;
      lastSpeaker = speaker;
      show(speaker, pickLine(REACTIONS[speaker.kind], `react-${speaker.kind}`), REACTION_MS);
      schedule(randomBetween(...CHATTER_GAP_MS));
    },
    update(motion, hidden) {
      const active = motion && !hidden;
      if (active === running) return;
      running = active;
      if (active) {
        schedule(randomBetween(...FIRST_CHATTER_MS));
        return;
      }
      window.clearTimeout(chatterTimer);
      hide();
    }
  };
}
