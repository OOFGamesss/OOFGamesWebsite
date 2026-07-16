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
  const label = game ? `Want ${game} for your venue? Get it free on Discord` : 'Support';

  const anchor = document.createElement('a');
  anchor.href = DISCORD_INVITE;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.setAttribute('aria-label', 'Join the OOF Games Discord support server');
  anchor.className =
    'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-neon-violet px-4 py-3 font-semibold text-white shadow-lg transition hover:bg-neon-magenta';
  anchor.innerHTML = `
    <svg viewBox="0 0 24 24" class="h-6 w-6 fill-current" aria-hidden="true">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.45 3l-.24.49a18.3 18.3 0 0 1 4.3 1.4 16.6 16.6 0 0 0-14.94 0 18.3 18.3 0 0 1 4.3-1.4L8.62 3a19.8 19.8 0 0 0-4.94 1.37C1.4 7.7.8 10.96 1.05 14.17a19.9 19.9 0 0 0 6.05 3.06l.78-1.07a13 13 0 0 1-2.05-.99c.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.14 0c.17.14.34.27.5.38a13 13 0 0 1-2.05.99l.78 1.07a19.9 19.9 0 0 0 6.05-3.06c.3-3.74-.66-6.97-2.43-9.8ZM8.7 12.96c-.96 0-1.75-.88-1.75-1.96 0-1.08.78-1.96 1.75-1.96.97 0 1.76.89 1.75 1.96 0 1.08-.78 1.96-1.75 1.96Zm6.6 0c-.96 0-1.75-.88-1.75-1.96 0-1.08.78-1.96 1.75-1.96.97 0 1.76.89 1.75 1.96 0 1.08-.78 1.96-1.75 1.96Z" />
    </svg>
    <span data-discord-widget-label class="hidden sm:inline">${label}</span>
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
  if (label && window.matchMedia) {
    const mq = window.matchMedia('(min-width: 640px)');
    const sync = () => label.style.setProperty('display', mq.matches ? 'inline' : 'none', 'important');
    sync();
    mq.addEventListener('change', sync);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountWidget);
} else {
  mountWidget();
}
