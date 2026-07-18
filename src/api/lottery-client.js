// Thin fetch wrapper for the Eorzea Lottery API: public draw/pot/stats reads
// plus session-cookie ticket views and purchases, sharing the same base URL
// resolution and result shape as the other API clients.

const PRODUCTION_API = 'https://api.oofgames.fyi/v1';

function resolveBaseUrl() {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return isLocal ? `http://${host}:8000` : PRODUCTION_API;
}

const apiBaseUrl = resolveBaseUrl();

function extractDetail(payload) {
  if (!payload || !payload.detail) return null;
  if (typeof payload.detail === 'string') return payload.detail;
  if (Array.isArray(payload.detail) && payload.detail[0]?.msg) return payload.detail[0].msg;
  return null;
}

async function request(path, options = {}) {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      credentials: 'include',
      ...options
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: extractDetail(payload) || `Request failed (${response.status})`
      };
    }
    return { ok: true, status: response.status, data: payload };
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server' };
  }
}

export const lotteryClient = {
  getCurrent: () => request('/lottery/current'),
  getHistory: (page = 1) => request(`/lottery/history?page=${page}`),
  getStats: () => request('/lottery/stats'),
  getWinners: (drawId) => request(`/lottery/draws/${drawId}/winners`),
  getMyTickets: () => request('/lottery/tickets'),
  buyTickets: (lines) =>
    request('/lottery/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines })
    })
};
