import './halloween.css';
import { getSettings, onChange } from '../graphics-settings.js';
import audio from './halloween-audio.js';
import { createChatter } from './halloween-chatter.js';
import { createFlyers } from './halloween-flyers.js';
import { mountScene } from './halloween-scene.js';

const root = document.documentElement;

function motionAllowed() {
  return getSettings().backgroundMotion;
}

function start() {
  const header = document.querySelector('[data-hub-hero]');
  if (!header) return;

  root.dataset.halloween = 'on';
  audio.init();

  const play = (name) => audio.play(name);
  const { pumpkins } = mountScene(header, { play, motionAllowed });
  const chatter = createChatter(pumpkins);
  const flyers = createFlyers(play);

  const sync = () => {
    const hidden = document.visibilityState === 'hidden';
    root.dataset.halloween = hidden ? 'paused' : 'on';
    flyers.update(motionAllowed(), hidden);
    chatter.update(motionAllowed(), hidden);
    audio.setHidden(hidden);
  };

  onChange(sync);
  document.addEventListener('visibilitychange', sync);
  sync();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
