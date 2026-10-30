/**
 * Where the API lives. Unset (local dev): same origin, which Vite proxies to :5000. Set
 * VITE_API_URL (e.g. https://api.example.com, no path) when the API is hosted separately.
 */
const apiOrigin = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, '') ?? '';

export const API_BASE_URL = `${apiOrigin}/api/v1`;

/** Socket.IO server URL: the API origin, or this page's origin when they're the same. */
export const SOCKET_URL = apiOrigin || window.location.origin;

/** Google's public STUN servers: enough for most home/office NATs. */
const STUN: RTCIceServer = { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] };

/**
 * WebRTC ICE servers. STUN alone fails behind symmetric NAT (many mobile networks and offices), so
 * a TURN relay is added when VITE_TURN_URL (comma-separated turn:/turns: URLs), VITE_TURN_USERNAME
 * and VITE_TURN_CREDENTIAL are set. These ship in the public bundle: use restricted or short-lived
 * credentials from your TURN provider.
 */
export const iceServersFrom = (env: Partial<Record<'VITE_TURN_URL' | 'VITE_TURN_USERNAME' | 'VITE_TURN_CREDENTIAL', string>>): RTCIceServer[] => {
  const urls = (env.VITE_TURN_URL ?? '').split(',').map((u) => u.trim()).filter(Boolean);
  if (!urls.length) return [STUN];
  return [STUN, { urls, username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL }];
};

export const ICE_SERVERS = iceServersFrom(import.meta.env);
