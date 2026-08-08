import { markSignedIn, markSignedOut } from './wallet-session.js';

const PRODUCTION_API = 'https://api.oofgames.fyi/v1';

function resolveBaseUrl() {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return isLocal ? `http://${host}:8000` : PRODUCTION_API;
}

export const apiBaseUrl = resolveBaseUrl();

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

async function tracked(pending) {
  const result = await pending;
  if (result.ok) markSignedIn();
  else if (result.status === 401 || result.status === 403) markSignedOut();
  return result;
}

export const walletClient = {
  login: (token) => tracked(jsonRequest('/account/login', 'POST', { token })),
  logout: async () => {
    const result = await request('/account/logout', { method: 'POST' });
    markSignedOut();
    return result;
  },
  getWallet: () => tracked(request('/account/wallet')),
  requestWithdrawal: (amount) => tracked(jsonRequest('/account/withdraw/request', 'POST', { amount })),
  cancelWithdrawal: () => tracked(request('/account/withdraw/cancel', { method: 'POST' })),
  getTransactions: (page = 1, type = null) =>
    tracked(request(`/account/transactions?page=${page}${type ? `&transaction_type=${type}` : ''}`))
};
