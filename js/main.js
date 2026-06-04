// Probes the API health endpoint and applies 3D card hover effects on page load.

import { apiClient } from './api-client.js';

function setStatusIndicator(isOnline) {
  const indicator = document.querySelector('[data-api-status]');
  if (!indicator) {
    return;
  }
  indicator.textContent = isOnline ? 'Services online' : 'Services offline';
  indicator.classList.toggle('text-neon-cyan', isOnline);
  indicator.classList.toggle('text-slate-500', !isOnline);
}

async function probeServices() {
  const result = await apiClient.getHealth();
  setStatusIndicator(result.ok !== false && result.status === 'ok');
}

function enableCardHover() {
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

probeServices();
enableCardHover();
