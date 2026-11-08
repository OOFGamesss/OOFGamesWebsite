import { element, randomBetween, replay } from './christmas-helpers.js';

const TEASES = [
  'No peeking until Christmas!',
  "Hands off, I'm not for you!",
  "Don't you dare shake me.",
  "I know what's inside. You don't.",
  'Mind the wrapping paper!',
  "Santa's watching, you know.",
  "You'll have to wait like everyone else.",
  'Careful with my ribbon!',
  'Not until the big day!',
  "Bet you can't guess what I am.",
  'Is it Christmas yet? No.',
  'I am NOT socks. Probably.'
];

const RETORTS = [
  'Oi! Wait for Christmas morning!',
  "You're on the naughty list now!",
  'Bah humbug!',
  'Mind my bow!',
  'I said no peeking!',
  "That's coal for you this year.",
  'Stop shaking me!',
  'Santa saw that, you know!',
  "Wrapping paper isn't cheap!"
];

const FIRST_TEASE_MS = [4000, 7000];
const TEASE_GAP_MS = [7000, 13000];
const TEASE_SHOW_MS = 4500;
const RETORT_SHOW_MS = 3000;
const EDGE_PX = 8;

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function createChatter(presents) {
  const bubbles = new Map();
  let speaker = null;
  let lastSpeaker = null;
  let lastLine = '';
  let teaseTimer = 0;
  let hideTimer = 0;
  let running = false;

  const hide = () => {
    window.clearTimeout(hideTimer);
    if (speaker) bubbles.get(speaker).bubble.classList.remove('is-speaking');
    speaker = null;
  };

  const fitOnScreen = (bubble) => {
    bubble.style.setProperty('--xm-shift', '0px');
    const rect = bubble.getBoundingClientRect();
    const limit = document.documentElement.clientWidth - EDGE_PX;
    let shift = 0;
    if (rect.right > limit) shift = limit - rect.right;
    if (rect.left + shift < EDGE_PX) shift = EDGE_PX - rect.left;
    bubble.style.setProperty('--xm-shift', `${Math.round(shift)}px`);
  };

  const say = (present, lines, showMs) => {
    const parts = bubbles.get(present);
    if (!parts || !present.isConnected) return;
    if (speaker !== present) hide();
    lastLine = pick(lines.filter((line) => line !== lastLine));
    parts.text.textContent = lastLine;
    fitOnScreen(parts.bubble);
    replay(parts.bubble, 'is-speaking');
    speaker = present;
    lastSpeaker = present;
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, showMs);
  };

  const tease = () => {
    const ready = presents.filter((present) => present.isConnected && present.classList.contains('is-shown'));
    const fresh = ready.filter((present) => present !== lastSpeaker);
    const choices = fresh.length ? fresh : ready;
    if (choices.length) say(pick(choices), TEASES, TEASE_SHOW_MS);
  };

  const schedule = (wait) => {
    window.clearTimeout(teaseTimer);
    teaseTimer = window.setTimeout(() => {
      tease();
      schedule(randomBetween(...TEASE_GAP_MS));
    }, wait);
  };

  for (const present of presents) {
    const bubble = element('div', 'xm-bubble');
    const text = element('div', 'xm-bubble__text');
    bubble.appendChild(text);
    present.appendChild(bubble);
    bubbles.set(present, { bubble, text });
    present.addEventListener('click', () => {
      say(present, RETORTS, RETORT_SHOW_MS);
      if (running) schedule(randomBetween(...TEASE_GAP_MS));
    });
  }

  return {
    update(motion, hidden) {
      if (motion && !hidden) {
        if (running) return;
        running = true;
        schedule(randomBetween(...FIRST_TEASE_MS));
        return;
      }
      running = false;
      window.clearTimeout(teaseTimer);
      hide();
    }
  };
}
