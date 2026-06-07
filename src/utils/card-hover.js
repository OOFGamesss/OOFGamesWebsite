// Applies a pointer-tracking 3D tilt effect to every [data-plugin-card] element.

export function enableCardHover() {
  const cards = document.querySelectorAll('[data-plugin-card]');
  cards.forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const bounds = card.getBoundingClientRect();
      const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
      const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
      card.style.transform = `perspective(800px) rotateX(${offsetY * -6}deg) rotateY(${offsetX * 6}deg)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });
}
