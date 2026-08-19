const CLIENT_ID_KEY = 'oof-chat-client-id';

function randomId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function chatClientId() {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored) return stored;
    const created = randomId();
    localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

export function createChatClient({ httpBase, wsBase, game, roomKey, getAuthToken }) {
  const room = `${encodeURIComponent(game)}/${encodeURIComponent(roomKey)}`;

  async function request(path, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Chat-Token'] = token;
    const auth = typeof getAuthToken === 'function' ? getAuthToken() : null;
    if (auth) headers.Authorization = `Bearer ${auth}`;
    if (method !== 'GET') headers['X-Chat-Client'] = chatClientId();

    try {
      const response = await fetch(`${httpBase}/chat/${room}${path}`, {
        method,
        headers,
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      if (response.status === 204) return { ok: true, status: 204, data: null };
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
    } catch {
      return { ok: false, status: 0, error: 'Could not reach the chat server.' };
    }
  }

  return {
    info: () => request(''),
    join: (displayName, colour) =>
      request('/join', { method: 'POST', body: { display_name: displayName, colour } }),
    send: (token, text) => request('/message', { method: 'POST', token, body: { text } }),
    setColour: (token, colour) => request('/colour', { method: 'POST', token, body: { colour } }),
    socketUrl: () => `${wsBase}/ws/chat/${room}`
  };
}
