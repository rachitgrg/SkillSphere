/**
 * Where the API lives. Unset (local dev): same origin, which Vite proxies to :5000. Set
 * VITE_API_URL (e.g. https://api.example.com, no path) when the API is hosted separately.
 */
const apiOrigin = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, '') ?? '';

export const API_BASE_URL = `${apiOrigin}/api/v1`;

/** Socket.IO server URL: the API origin, or this page's origin when they're the same. */
export const SOCKET_URL = apiOrigin || window.location.origin;
