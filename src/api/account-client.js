const PRODUCTION_API = 'https://api.oofgames.fyi/v1';

function resolveBaseUrl() {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return isLocal ? `http://${host}:8000` : PRODUCTION_API;
}

export const apiBaseUrl = resolveBaseUrl();
export const discordLoginUrl = `${apiBaseUrl}/auth/discord/login`;

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
  } catch (error) {
    return { ok: false, status: 0, error: 'Could not reach the server' };
  }
}

function jsonRequest(path, method, body) {
  return request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export const accountClient = {
  getMe: () => request('/users/me'),
  updateProfile: (customUsername) =>
    jsonRequest('/users/me', 'PATCH', { custom_username: customUsername }),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/users/me/avatar', { method: 'POST', body: form });
  },
  deleteAccount: () => request('/users/me', { method: 'DELETE' }),
  exportData: () => request('/users/me/export'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  getGameTypes: () => request('/games/types'),
  getMyGames: () => request('/games/mine'),
  submitGame: (game) => jsonRequest('/games', 'POST', game),
  editGame: (gameId, game) => jsonRequest(`/games/${gameId}`, 'PUT', game),
  cancelChanges: (gameId) => request(`/games/${gameId}/changes`, { method: 'DELETE' }),
  withdrawGame: (gameId) => request(`/games/${gameId}`, { method: 'DELETE' }),

  getPendingGames: () => request('/admin/games/pending'),
  approveGame: (gameId) => request(`/admin/games/${gameId}/approve`, { method: 'POST' }),
  rejectGame: (gameId, reason) => jsonRequest(`/admin/games/${gameId}/reject`, 'POST', { reason }),
  createGameType: (name) => jsonRequest('/admin/game-types', 'POST', { name }),
  deleteGameType: (typeId) => request(`/admin/game-types/${typeId}`, { method: 'DELETE' })
};
