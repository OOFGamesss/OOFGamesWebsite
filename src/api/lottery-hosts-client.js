const EVENTS_URL = 'https://api.oofgames.fyi/v1/events';

const LOTTERY_HOSTS = [
  'Felix Shadow Twintania',
  'Felix Halo Twintania',
  'Tugan Sprite Phantom'
];

const hostOrder = new Map(LOTTERY_HOSTS.map((name, index) => [name.toLowerCase(), index]));

const rank = (event) => hostOrder.get(String(event.character_name).toLowerCase());

export async function getLotteryHosts() {
  let payload = null;
  try {
    const response = await fetch(EVENTS_URL);
    if (!response.ok) return { ok: false, error: `Request failed (${response.status})` };
    payload = await response.json();
  } catch {
    return { ok: false, error: 'Could not reach the server' };
  }
  if (!Array.isArray(payload)) return { ok: false, error: 'Unexpected response' };

  const hosts = payload
    .filter((event) => event && event.is_active !== false)
    .filter((event) => String(event.game || '').toLowerCase() === 'lottery')
    .filter((event) => hostOrder.has(String(event.character_name || '').toLowerCase()))
    .sort((a, b) => rank(a) - rank(b));
  return { ok: true, hosts };
}
