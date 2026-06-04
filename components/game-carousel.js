// Builds a screenshot carousel inside any [data-game-id] element by fetching the game's manifest.json image list.

async function initCarousel(el) {
  const gameId = el.dataset.gameId;
  let images = [];

  try {
    const res = await fetch(`/pages/minigames-emporium/games/game-images/${gameId}/manifest.json`);
    if (res.ok) images = await res.json();
  } catch {}

  if (!images.length) return;

  const total = images.length;
  let current = 0;

  el.innerHTML = `
    <div class="relative aspect-video w-full overflow-hidden rounded-2xl border border-neon-violet/30 bg-night-deep/60">
      <img
        src="/pages/minigames-emporium/games/game-images/${gameId}/${images[0]}"
        alt="Screenshot 1 of ${total}"
        class="h-full w-full object-contain"
      />
      ${total > 1 ? `
        <button class="carousel-prev absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-neon-violet/40 bg-night-panel/80 px-3 py-1 text-2xl leading-none text-slate-300 backdrop-blur-sm transition hover:border-neon-cyan hover:text-neon-cyan" aria-label="Previous screenshot">&#8249;</button>
        <button class="carousel-next absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-neon-violet/40 bg-night-panel/80 px-3 py-1 text-2xl leading-none text-slate-300 backdrop-blur-sm transition hover:border-neon-cyan hover:text-neon-cyan" aria-label="Next screenshot">&#8250;</button>
        <div class="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2" data-dots>
          ${images.map((_, i) => `<span class="h-2 w-2 rounded-full ${i === 0 ? 'bg-neon-cyan' : 'bg-slate-600'}"></span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;

  const imgEl = el.querySelector('img');
  const dotsEl = el.querySelector('[data-dots]');

  const update = () => {
    imgEl.src = `/pages/minigames-emporium/games/game-images/${gameId}/${images[current]}`;
    imgEl.alt = `Screenshot ${current + 1} of ${total}`;
    dotsEl?.querySelectorAll('span').forEach((dot, i) => {
      dot.className = `h-2 w-2 rounded-full ${i === current ? 'bg-neon-cyan' : 'bg-slate-600'}`;
    });
  };

  el.querySelector('.carousel-prev')?.addEventListener('click', () => {
    current = (current - 1 + total) % total;
    update();
  });

  el.querySelector('.carousel-next')?.addEventListener('click', () => {
    current = (current + 1) % total;
    update();
  });
}

document.querySelectorAll('[data-game-id]').forEach(initCarousel);
