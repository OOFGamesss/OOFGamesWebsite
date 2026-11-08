import './christmas.css';
import { getSettings, onChange } from '../graphics-settings.js';
import audio from './christmas-audio.js';
import { createChatter } from './christmas-chatter.js';
import { createFlyers } from './christmas-flyers.js';
import { mountScene } from './christmas-scene.js';

const root = document.documentElement;

function motionAllowed() {
  return getSettings().backgroundMotion;
}

function start() {
  const header = document.querySelector('[data-hub-hero]');
  if (!header) return;

  root.dataset.christmas = 'on';
  audio.init();

  const play = (name) => audio.play(name);
  const { presents } = mountScene(header, { play, motionAllowed });
  const chatter = createChatter(presents);
  const flyers = createFlyers(play);

  const sync = () => {
    const hidden = document.visibilityState === 'hidden';
    root.dataset.christmas = hidden ? 'paused' : 'on';
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
