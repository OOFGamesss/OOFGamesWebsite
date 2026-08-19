const PROD = {
  http: 'https://api.oofgames.fyi/v1/chocobo-racing',
  ws: 'wss://api.oofgames.fyi/v1/chocobo-racing',
};
function bases() {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket -- loopback-only dev backend has no TLS; all non-local traffic uses PROD (wss)
  return isLocal ? { http: `http://${host}:8004`, ws: `ws://${host}:8004` } : PROD;
}

export function chatBases() {
  const { http, ws } = bases();
  return { httpBase: http, wsBase: ws };
}

export function uuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function request(path, { method = 'GET', body, headers = {}, credentials } = {}) {
  const target = `${bases().http}${path}`;
  try {
    const response = await fetch(target, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...(credentials ? { credentials } : {}),
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const detail = data && data.detail;
      const message = Array.isArray(detail) ? detail.join(', ') : detail;
      return { ok: false, status: response.status, error: message || `Request failed (${response.status})` };
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: 'Network error - could not reach the race server.' };
  }
}

export function getState(sessionId) {
  return request(`/session/${encodeURIComponent(sessionId)}/state`);
}

export function login(sessionId, pin) {
  return request('/auth/login', { method: 'POST', body: { sessionId, pin } });
}

export function me(token) {
  return request('/me', { headers: { Authorization: `Bearer ${token}` } });
}

export function placeBet(token, chocobo, amount, idempotencyKey) {
  return request('/bet', {
    method: 'POST',
    body: { chocobo, amount },
    headers: { Authorization: `Bearer ${token}`, 'X-Idempotency-Key': idempotencyKey },
  });
}

export function raceSocketUrl(sessionId) {
  return `${bases().ws}/ws/race/${encodeURIComponent(sessionId)}`;
}

export function houseState() {
  return request('/house/state');
}

export function liveSessions() {
  return request('/live/sessions');
}

export function houseMe() {
  return request('/house/me', { credentials: 'include' });
}

export function houseBet(chocobo, amount, idempotencyKey) {
  return request('/house/bet', {
    method: 'POST',
    body: { chocobo, amount },
    headers: { 'X-Idempotency-Key': idempotencyKey },
    credentials: 'include',
  });
}
