import { getSettings, motionLocked, onChange, setBackgroundMotion, setQuality } from './graphics-settings.js';
import {
  getAudioSettings,
  onAudioChange,
  setMusicOn,
  setMusicVolume,
  setSfxOn,
  setSfxVolume
} from './audio-settings.js';

const GEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`;

function ensureStyles() {
  if (document.getElementById('oof-settings-styles')) return;
  const style = document.createElement('style');
  style.id = 'oof-settings-styles';
  style.textContent = `
    .oof-settings { position: fixed; left: 16px; bottom: 16px; z-index: 50; font-family: inherit; }
    .oof-settings__btn {
      display: grid; place-items: center; width: 40px; height: 40px; padding: 0;
      border-radius: 999px; cursor: pointer; color: #cbd5e1;
      border: 1px solid rgba(139, 92, 255, 0.4); background: rgba(20, 10, 38, 0.92);
      transition: color 0.15s ease, border-color 0.15s ease;
    }
    .oof-settings__btn svg { width: 20px; height: 20px; }
    .oof-settings__btn:hover { color: #18e0ff; border-color: #18e0ff; }
    .oof-settings__panel {
      position: absolute; left: 0; bottom: 50px; width: 250px; padding: 14px;
      display: none; flex-direction: column; gap: 14px;
      max-height: calc(100vh - 90px); overflow-y: auto;
      border-radius: 14px; border: 1px solid rgba(139, 92, 255, 0.35);
      background: rgba(29, 18, 53, 0.97); color: #e2e8f0;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .oof-settings.is-open .oof-settings__panel { display: flex; }
    .oof-settings__title {
      margin: 0; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em;
      text-transform: uppercase; color: #94a3b8;
    }
    .oof-settings__title + .oof-settings__row { margin-top: -4px; }
    .oof-settings__sep { height: 1px; border: 0; margin: 2px 0; background: rgba(139, 92, 255, 0.28); }
    .oof-settings__row { display: flex; flex-direction: column; gap: 7px; }
    .oof-settings__label { font-size: 0.86rem; font-weight: 600; }
    .oof-settings__hint { margin: 0; font-size: 0.72rem; line-height: 1.35; color: #94a3b8; }
    .oof-settings__choices { display: flex; gap: 6px; }
    .oof-settings__choice {
      flex: 1 1 0; padding: 6px 4px; border-radius: 8px; cursor: pointer;
      font-size: 0.78rem; font-weight: 700; color: #cbd5e1;
      border: 1px solid rgba(139, 92, 255, 0.4); background: transparent;
    }
    .oof-settings__choice[aria-pressed="true"] { color: #0a0612; background: #18e0ff; border-color: #18e0ff; }
    .oof-settings__slider {
      width: calc(100% - 4px); height: 5px; margin: 12px 2px 4px;
      -webkit-appearance: none; appearance: none;
      border-radius: 999px; outline: none; cursor: pointer;
      background: rgba(139, 92, 255, 0.45);
    }
    .oof-settings__slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 15px; height: 15px;
      border-radius: 50%; background: #18e0ff; cursor: pointer;
      box-shadow: 0 0 0 3px rgba(29, 18, 53, 0.97);
    }
    .oof-settings__slider::-moz-range-thumb {
      width: 15px; height: 15px; border: none; border-radius: 50%;
      background: #18e0ff; cursor: pointer;
      box-shadow: 0 0 0 3px rgba(29, 18, 53, 0.97);
    }
    .oof-settings__slider:disabled { opacity: 0.4; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
}

function heading(text) {
  const node = document.createElement('h2');
  node.className = 'oof-settings__title';
  node.textContent = text;
  return node;
}

function separator() {
  const node = document.createElement('hr');
  node.className = 'oof-settings__sep';
  return node;
}

function choiceRow(labelText, name, options, hintText) {
  const row = document.createElement('div');
  row.className = 'oof-settings__row';

  const label = document.createElement('span');
  label.className = 'oof-settings__label';
  label.textContent = labelText;
  row.appendChild(label);

  const choices = document.createElement('div');
  choices.className = 'oof-settings__choices';
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'oof-settings__choice';
    button.textContent = option.label;
    button.dataset.setting = name;
    button.dataset.value = option.value;
    choices.appendChild(button);
  }
  row.appendChild(choices);

  if (hintText) {
    const hint = document.createElement('p');
    hint.className = 'oof-settings__hint';
    hint.textContent = hintText;
    row.appendChild(hint);
  }
  return row;
}

function sliderRow(labelText, name, options) {
  const row = choiceRow(labelText, name, options);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.className = 'oof-settings__slider';
  slider.dataset.volume = name;
  slider.setAttribute('aria-label', `${labelText} volume`);
  row.appendChild(slider);
  return row;
}

function mount() {
  if (document.querySelector('[data-oof-settings]')) return;
  ensureStyles();

  const wrap = document.createElement('div');
  wrap.className = 'oof-settings';
  wrap.dataset.oofSettings = 'true';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'oof-settings__btn';
  button.innerHTML = GEAR;
  button.setAttribute('aria-label', 'Settings');
  button.setAttribute('aria-expanded', 'false');
  wrap.appendChild(button);

  const panel = document.createElement('div');
  panel.className = 'oof-settings__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Settings');

  panel.appendChild(heading('Display'));
  if (!motionLocked()) {
    panel.appendChild(choiceRow('Background animation', 'motion', [
      { label: 'On', value: 'on' },
      { label: 'Off', value: 'off' }
    ]));
  }
  panel.appendChild(choiceRow('Graphics quality', 'quality', [
    { label: 'High', value: 'high' },
    { label: 'Low', value: 'low' }
  ], 'Turns off glows and blur effects. Use this if the page feels slow.'));

  panel.appendChild(separator());
  panel.appendChild(heading('Sound'));
  panel.appendChild(sliderRow('Music', 'music', [
    { label: 'On', value: 'on' },
    { label: 'Off', value: 'off' }
  ]));
  panel.appendChild(sliderRow('Sound effects', 'sfx', [
    { label: 'On', value: 'on' },
    { label: 'Off', value: 'off' }
  ]));

  wrap.appendChild(panel);
  document.body.appendChild(wrap);

  const sync = () => {
    const { quality, backgroundMotion } = getSettings();
    const { musicOn, sfxOn, musicVol, sfxVol } = getAudioSettings();
    const current = {
      quality,
      motion: backgroundMotion ? 'on' : 'off',
      music: musicOn ? 'on' : 'off',
      sfx: sfxOn ? 'on' : 'off'
    };
    panel.querySelectorAll('.oof-settings__choice').forEach((choice) => {
      choice.setAttribute('aria-pressed', String(current[choice.dataset.setting] === choice.dataset.value));
    });
    panel.querySelectorAll('[data-volume]').forEach((slider) => {
      const isMusic = slider.dataset.volume === 'music';
      slider.value = String(Math.round((isMusic ? musicVol : sfxVol) * 100));
      slider.disabled = !(isMusic ? musicOn : sfxOn);
    });
  };

  const setOpen = (open) => {
    wrap.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  };

  button.addEventListener('click', () => setOpen(!wrap.classList.contains('is-open')));

  panel.addEventListener('click', (event) => {
    const choice = event.target.closest('.oof-settings__choice');
    if (!choice) return;
    const on = choice.dataset.value === 'on';
    if (choice.dataset.setting === 'quality') setQuality(choice.dataset.value);
    else if (choice.dataset.setting === 'motion') setBackgroundMotion(on);
    else if (choice.dataset.setting === 'music') setMusicOn(on);
    else if (choice.dataset.setting === 'sfx') setSfxOn(on);
  });

  panel.addEventListener('input', (event) => {
    const slider = event.target.closest('[data-volume]');
    if (!slider) return;
    const value = parseInt(slider.value, 10) / 100;
    if (slider.dataset.volume === 'music') setMusicVolume(value);
    else setSfxVolume(value);
  });

  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  onChange(sync);
  onAudioChange(sync);
  sync();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
