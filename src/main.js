import { apiClient } from './api/api-client.js';
import { enableCardHover } from './utils/card-hover.js';

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

probeServices();
enableCardHover();
