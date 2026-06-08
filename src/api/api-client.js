// Fetch-based API client that auto-selects the production or development base URL based on hostname.

const PRODUCTION_API = 'https://api.oofgames.fyi/v1';
const DEVELOPMENT_API = 'http://127.0.0.1:8000';

function resolveBaseUrl() {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return isLocal ? DEVELOPMENT_API : PRODUCTION_API;
}

const baseUrl = resolveBaseUrl();

async function request(path, options = {}) {
  const target = `${baseUrl}${path}`;
  try {
    const response = await fetch(target, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
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
