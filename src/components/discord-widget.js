const DISCORD_INVITE = 'https://discord.gg/vM6ff4h5Ym';

const PITCH_PAGES = [
  { path: '/chocobo-racing/race', game: 'Chocobo Racing' },
  { path: '/mini-games-emporium/drt/bracket', game: 'Deathroll Tournament' }
];

function pitchGame() {
  const match = PITCH_PAGES.find((page) => window.location.pathname.includes(page.path));
  return match ? match.game : null;
}

function buildWidget() {
  const game = pitchGame();
  const pitch = game ? `Want ${game} for your venue? Get it free on Discord` : '';

  const anchor = document.createElement('a');
  anchor.href = DISCORD_INVITE;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.setAttribute('aria-label', 'Join the OOF Games Discord support server');
  anchor.className =
    'group fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-neon-violet px-4 py-3 font-semibold text-white shadow-lg transition-colors hover:bg-neon-magenta';
  anchor.innerHTML = `
    <svg viewBox="0 0 24 24" class="h-6 w-6 shrink-0 fill-current" aria-hidden="true">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.45 3l-.24.49a18.3 18.3 0 0 1 4.3 1.4 16.6 16.6 0 0 0-14.94 0 18.3 18.3 0 0 1 4.3-1.4L8.62 3a19.8 19.8 0 0 0-4.94 1.37C1.4 7.7.8 10.96 1.05 14.17a19.9 19.9 0 0 0 6.05 3.06l.78-1.07a13 13 0 0 1-2.05-.99c.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.14 0c.17.14.34.27.5.38a13 13 0 0 1-2.05.99l.78 1.07a19.9 19.9 0 0 0 6.05-3.06c.3-3.74-.66-6.97-2.43-9.8ZM8.7 12.96c-.96 0-1.75-.88-1.75-1.96 0-1.08.78-1.96 1.75-1.96.97 0 1.76.89 1.75 1.96 0 1.08-.78 1.96-1.75 1.96Zm6.6 0c-.96 0-1.75-.88-1.75-1.96 0-1.08.78-1.96 1.75-1.96.97 0 1.76.89 1.75 1.96 0 1.08-.78 1.96-1.75 1.96Z" />
    </svg>
    <span data-discord-widget-label class="hidden items-center whitespace-nowrap sm:flex">
      <span>Support</span>
      ${pitch
        ? `<span data-discord-widget-pitch class="max-w-0 overflow-hidden transition-[max-width] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[max-width] group-hover:max-w-[var(--pitch-width,32rem)]"><span class="inline-block translate-x-3 opacity-0 transition delay-0 duration-500 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-200 group-hover:duration-700">&nbsp;&middot;&nbsp;${pitch}</span></span>`
        : ''}
    </span>
  `;
  return anchor;
}

function mountWidget() {
  if (document.querySelector('[data-discord-widget]')) {
    return;
  }
  const widget = buildWidget();
  widget.dataset.discordWidget = 'true';
  document.body.appendChild(widget);

  const label = widget.querySelector('[data-discord-widget-label]');
  const pitch = widget.querySelector('[data-discord-widget-pitch]');
  const measurePitch = () => {
    if (pitch && pitch.scrollWidth) {
      pitch.style.setProperty('--pitch-width', `${pitch.scrollWidth + 1}px`);
    }
  };

  if (label && window.matchMedia) {
    const mq = window.matchMedia('(min-width: 640px)');
    const sync = () => {
      label.style.setProperty('display', mq.matches ? 'flex' : 'none', 'important');
      if (mq.matches) {
        measurePitch();
      }
    };
    sync();
    mq.addEventListener('change', sync);
  } else {
    measurePitch();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measurePitch);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountWidget);
} else {
  mountWidget();
}
