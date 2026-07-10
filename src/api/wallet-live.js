import { apiBaseUrl } from './wallet-client.js';

const WS_URL = `${apiBaseUrl.replace(/^http/, 'ws')}/account/ws`;
const MAX_BACKOFF_MS = 30000;

export function connectWalletSocket(onWallet) {
  let socket = null;
  let attempts = 0;
  let stopped = false;

  const open = () => {
    if (stopped) return;
    socket = new WebSocket(WS_URL);
    socket.onopen = () => {
      attempts = 0;
    };
    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type === 'wallet') onWallet(data);
    };
    socket.onclose = (event) => {
      socket = null;
      if (stopped || event.code === 1008) return;
      attempts += 1;
      setTimeout(open, Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempts));
    };
  };

  open();
  return () => {
    stopped = true;
    if (socket) socket.close();
  };
}
