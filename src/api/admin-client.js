import { apiBaseUrl } from './account-client.js';

export const adminLoginUrl = `${apiBaseUrl}/auth/discord/login?next=admin`;

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

function jsonRequest(path, method, body) {
  return request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export const adminClient = {
  getMe: () => request('/users/me'),
  getSummary: () => request('/admin/wallet/summary'),
  getLedger: (page = 1) => request(`/admin/wallet/ledger?page=${page}`),
  getGamesProfit: (period = '7d') => request(`/admin/games/summary?period=${encodeURIComponent(period)}`),
  getPlayers: (page = 1, search = '') =>
    request(`/admin/wallet/players?page=${page}&search=${encodeURIComponent(search)}`),
  getPlayerDetail: (contentId) => request(`/admin/wallet/players/${contentId}`),
  getUsers: (page = 1, search = '') =>
    request(`/admin/users?page=${page}&search=${encodeURIComponent(search)}`),
  getHosts: () => request('/admin/hosts'),
  getLogs: (page = 1) => request(`/admin/logs?page=${page}`),
  getBans: () => request('/admin/bans'),
  createBan: (banType, subjectId, reason) =>
    jsonRequest('/admin/bans', 'POST', { ban_type: banType, subject_id: subjectId, reason }),
  removeBan: (banId) => request(`/admin/bans/${banId}`, { method: 'DELETE' }),

  getLottery: (potPage = 1) => request(`/admin/lottery?pot_page=${potPage}`),
  adjustLotteryPot: (amount, note) => jsonRequest('/admin/lottery/pot-adjust', 'POST', { amount, note }),
  updateLotterySchedule: (payload) => jsonRequest('/admin/lottery/schedule', 'PUT', payload),
  moveLotteryDraw: (drawId, scheduledAt) =>
    jsonRequest(`/admin/lottery/draws/${drawId}/schedule`, 'PUT', { scheduled_at: scheduledAt }),
  skipLotteryDraw: (drawId) => jsonRequest(`/admin/lottery/draws/${drawId}/skip`, 'POST', {}),
  submitLotteryDraw: (drawId, mainNumbers, bonusNumber) =>
    jsonRequest('/admin/lottery/draw', 'POST', {
      draw_id: drawId,
      main_numbers: mainNumbers,
      bonus_number: bonusNumber
    }),

  getPendingGames: () => request('/admin/games/pending'),
  approveGame: (gameId) => request(`/admin/games/${gameId}/approve`, { method: 'POST' }),
  rejectGame: (gameId, reason) => jsonRequest(`/admin/games/${gameId}/reject`, 'POST', { reason }),
  createGameType: (payload) => jsonRequest('/admin/game-types', 'POST', payload),
  updateGameType: (typeId, payload) => jsonRequest(`/admin/game-types/${typeId}`, 'PUT', payload),
  deleteGameType: (typeId) => request(`/admin/game-types/${typeId}`, { method: 'DELETE' })
};
