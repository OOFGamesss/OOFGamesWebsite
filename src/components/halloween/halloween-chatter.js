import { element, randomBetween, replay } from './halloween-helpers.js';

const TEASES = [
  "Don't you dare touch me!",
  'Hands off the pumpkin!',
  "Whatever you do, don't click me.",
  'I bite, you know.',
  "Touch me and you'll regret it...",
  'No poking. I mean it.',
  'Keep your mitts to yourself!',
  "I'm warning you, don't click.",
  'Personal space, please!',
  'Go on, I dare you...',
  "Don't even think about it.",
  'I am NOT ticklish.'
];

const RETORTS = [
  "I said don't touch me!",
  'Oi! Hands off!',
  'Rude!',
  "That's it, you're cursed.",
  'Ow! My stem!',
  'Stop that this instant!',
  "You'll pay for that!",
  'Do that again. I dare you.',
  'How very dare you!'
];

const FIRST_TEASE_MS = [4000, 7000];
const TEASE_GAP_MS = [7000, 13000];
const TEASE_SHOW_MS = 4500;
const RETORT_SHOW_MS = 3000;
const EDGE_PX = 8;

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function createChatter(pumpkins) {
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
    bubble.style.setProperty('--hw-shift', '0px');
    const rect = bubble.getBoundingClientRect();
    const limit = document.documentElement.clientWidth - EDGE_PX;
    let shift = 0;
    if (rect.right > limit) shift = limit - rect.right;
    if (rect.left + shift < EDGE_PX) shift = EDGE_PX - rect.left;
    bubble.style.setProperty('--hw-shift', `${Math.round(shift)}px`);
  };

  const say = (pumpkin, lines, showMs) => {
    const parts = bubbles.get(pumpkin);
    if (!parts || !pumpkin.isConnected) return;
    if (speaker !== pumpkin) hide();
    lastLine = pick(lines.filter((line) => line !== lastLine));
    parts.text.textContent = lastLine;
    fitOnScreen(parts.bubble);
    replay(parts.bubble, 'is-speaking');
    speaker = pumpkin;
    lastSpeaker = pumpkin;
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, showMs);
  };

  const tease = () => {
    const ready = pumpkins.filter((pumpkin) => pumpkin.isConnected && pumpkin.classList.contains('is-shown'));
    const fresh = ready.filter((pumpkin) => pumpkin !== lastSpeaker);
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

  for (const pumpkin of pumpkins) {
    const bubble = element('div', 'hw-bubble');
    const text = element('div', 'hw-bubble__text');
    bubble.appendChild(text);
    pumpkin.appendChild(bubble);
    bubbles.set(pumpkin, { bubble, text });
    pumpkin.addEventListener('click', () => {
      say(pumpkin, RETORTS, RETORT_SHOW_MS);
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
