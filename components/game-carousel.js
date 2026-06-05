// Builds a screenshot carousel inside any [data-game-id] element by probing for
// sequentially numbered images (1.png, 2.png, ...) in the game's image folder.
// The carousel tints its controls with the game's accent colour (data-accent),
// supports clickable position dots, and opens a zoomable full-screen lightbox.

const IMAGE_BASE = '/game-images';
const MAX_IMAGES = 50;
const DEFAULT_ACCENT = '#18e0ff';
const ZOOM_SCALE = 2.5;

const CHEVRON_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="h-7 w-7" aria-hidden="true"><polyline points="15 4 7 12 15 20"></polyline></svg>`;
const CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="h-7 w-7" aria-hidden="true"><polyline points="9 4 17 12 9 20"></polyline></svg>`;

function ensureStyles() {
  if (document.getElementById('carousel-styles')) return;

  const style = document.createElement('style');
  style.id = 'carousel-styles';
  style.textContent = `
    .carousel-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
      line-height: 1;
    }
    .carousel-arrow:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    .carousel-dot {
      cursor: pointer;
      padding: 0;
    }
    .carousel-dot.is-active {
      background-color: var(--accent);
    }
    .carousel-img {
      cursor: zoom-in;
    }
    .carousel-lightbox {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3.5rem 1rem;
      background: rgba(5, 3, 10, 0.92);
      backdrop-filter: blur(6px);
      animation: carouselFadeIn 0.18s ease-out both;
    }
    .carousel-lightbox-img {
      max-height: 100%;
      max-width: 100%;
      object-fit: contain;
      cursor: zoom-in;
      transition: transform 0.25s ease;
      transform-origin: center center;
    }
    .carousel-lightbox-img.is-zoomed {
      transform: scale(${ZOOM_SCALE});
      cursor: zoom-out;
    }
    @keyframes carouselFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

function imageExists(src) {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(true);
    probe.onerror = () => resolve(false);
    probe.src = src;
  });
}

async function discoverImages(gameId) {
  const found = [];

  for (let index = 1; index <= MAX_IMAGES; index += 1) {
    const fileName = `${index}.png`;
    const exists = await imageExists(`${IMAGE_BASE}/${gameId}/${fileName}`);
    if (!exists) break;
    found.push(fileName);
  }

  return found;
}

function openLightbox(gameId, images, startIndex, accent) {
  const total = images.length;
  let current = startIndex;

  const root = document.createElement('div');
  root.className = 'carousel-lightbox';
  root.style.setProperty('--accent', accent);

  root.innerHTML = `
    <button class="carousel-arrow absolute right-4 top-4 rounded-full border border-neon-violet/40 bg-night-panel/80 text-3xl text-slate-300 backdrop-blur-sm transition" data-close aria-label="Close viewer">&times;</button>
    <img class="carousel-lightbox-img" src="${IMAGE_BASE}/${gameId}/${images[current]}" alt="Screenshot ${current + 1} of ${total}" />
    ${total > 1 ? `
      <button class="carousel-arrow absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-neon-violet/40 bg-night-panel/80 text-slate-300 backdrop-blur-sm transition" data-prev aria-label="Previous screenshot">${CHEVRON_LEFT}</button>
      <button class="carousel-arrow absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-neon-violet/40 bg-night-panel/80 text-slate-300 backdrop-blur-sm transition" data-next aria-label="Next screenshot">${CHEVRON_RIGHT}</button>
      <div class="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2" data-dots>
        ${images.map((_, i) => `<button class="carousel-dot h-2.5 w-2.5 rounded-full ${i === current ? 'is-active' : 'bg-slate-600'}" aria-label="Go to screenshot ${i + 1}"></button>`).join('')}
      </div>
    ` : ''}
  `;

  const imgEl = root.querySelector('.carousel-lightbox-img');
  const dotEls = root.querySelectorAll('[data-dots] .carousel-dot');

  const render = () => {
    imgEl.classList.remove('is-zoomed');
    imgEl.style.transformOrigin = 'center center';
    imgEl.src = `${IMAGE_BASE}/${gameId}/${images[current]}`;
    imgEl.alt = `Screenshot ${current + 1} of ${total}`;
    dotEls.forEach((dot, i) => {
      dot.className = `carousel-dot h-2.5 w-2.5 rounded-full ${i === current ? 'is-active' : 'bg-slate-600'}`;
    });
  };

  const step = (delta) => {
    current = (current + delta + total) % total;
    render();
  };

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    document.body.style.overflow = '';
    root.remove();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
  };

  const focusZoomAtCursor = (event) => {
    const rect = imgEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    imgEl.style.transformOrigin = `${x}% ${y}%`;
  };

  imgEl.addEventListener('click', (event) => {
    if (imgEl.classList.contains('is-zoomed')) {
      imgEl.classList.remove('is-zoomed');
    } else {
      focusZoomAtCursor(event);
      imgEl.classList.add('is-zoomed');
    }
  });

  imgEl.addEventListener('mousemove', (event) => {
    if (imgEl.classList.contains('is-zoomed')) focusZoomAtCursor(event);
  });

  root.addEventListener('click', (event) => {
    if (event.target === root) close();
  });

  root.querySelector('[data-close]')?.addEventListener('click', close);
  root.querySelector('[data-prev]')?.addEventListener('click', () => step(-1));
  root.querySelector('[data-next]')?.addEventListener('click', () => step(1));
  dotEls.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      current = i;
      render();
    });
  });

  document.addEventListener('keydown', onKeyDown);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(root);
}

async function initCarousel(el) {
  const gameId = el.dataset.gameId;
  const accent = el.dataset.accent || DEFAULT_ACCENT;
  const images = await discoverImages(gameId);

  if (!images.length) return;

  ensureStyles();
  el.style.setProperty('--accent', accent);

  const total = images.length;
  let current = 0;

  el.innerHTML = `
    <div class="relative aspect-video w-full overflow-hidden rounded-2xl border border-neon-violet/30 bg-night-deep/60">
      <img
        src="${IMAGE_BASE}/${gameId}/${images[0]}"
        alt="Screenshot 1 of ${total}"
        class="carousel-img h-full w-full object-contain"
      />
      ${total > 1 ? `
        <button class="carousel-arrow carousel-prev absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-neon-violet/40 bg-night-panel/80 text-slate-300 backdrop-blur-sm transition" aria-label="Previous screenshot">${CHEVRON_LEFT}</button>
        <button class="carousel-arrow carousel-next absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-neon-violet/40 bg-night-panel/80 text-slate-300 backdrop-blur-sm transition" aria-label="Next screenshot">${CHEVRON_RIGHT}</button>
        <div class="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2" data-dots>
          ${images.map((_, i) => `<button class="carousel-dot h-2.5 w-2.5 rounded-full ${i === 0 ? 'is-active' : 'bg-slate-600'}" aria-label="Go to screenshot ${i + 1}"></button>`).join('')}
        </div>
      ` : ''}
    </div>
  `;

  const imgEl = el.querySelector('.carousel-img');
  const dotEls = el.querySelectorAll('[data-dots] .carousel-dot');

  const update = () => {
    imgEl.src = `${IMAGE_BASE}/${gameId}/${images[current]}`;
    imgEl.alt = `Screenshot ${current + 1} of ${total}`;
    dotEls.forEach((dot, i) => {
      dot.className = `carousel-dot h-2.5 w-2.5 rounded-full ${i === current ? 'is-active' : 'bg-slate-600'}`;
    });
  };

  imgEl.addEventListener('click', () => openLightbox(gameId, images, current, accent));

  el.querySelector('.carousel-prev')?.addEventListener('click', () => {
    current = (current - 1 + total) % total;
    update();
  });

  el.querySelector('.carousel-next')?.addEventListener('click', () => {
    current = (current + 1) % total;
    update();
  });

  dotEls.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      current = i;
      update();
    });
  });
}

document.querySelectorAll('[data-game-id]').forEach(initCarousel);
