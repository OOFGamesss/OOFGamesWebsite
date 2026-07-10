const PRODUCTION_API = 'https://api.oofgames.fyi/v1';

function resolveBaseUrl() {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return isLocal ? `http://${host}:8000` : PRODUCTION_API;
}

const baseUrl = resolveBaseUrl();

async function request(path, options = {}) {
  const target = `${baseUrl}${path}`;
  try {
    const response = await fetch(target, options);
    if (!response.ok) {
      throw new Error(`Request to ${path} failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function getHealth() {
  return request('/system/health');
}

export const apiClient = { getHealth };
