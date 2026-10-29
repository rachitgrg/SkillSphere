import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// The API the dev server proxies to; e2e runs point it at the in-memory API (see playwright.config.ts).
const apiTarget = process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:5000';

/**
 * Content-Security-Policy for production builds, as a <meta> tag so it ships with any static host.
 * Allows the API (VITE_API_URL, or same origin), Razorpay Checkout, Cloudinary media, Google
 * avatars and Google Fonts. Dev builds skip it: Vite's HMR client relies on inline scripts.
 */
const contentSecurityPolicy = (apiUrl?: string): Plugin => {
  const api = apiUrl ? new URL(apiUrl).origin : '';
  const ws = api.replace(/^http/, 'ws');
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://checkout.razorpay.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://*.googleusercontent.com', 'https://*.razorpay.com'],
    'media-src': ["'self'", 'blob:', 'https://res.cloudinary.com'],
    'connect-src': ["'self'", ...(api ? [api, ws] : []), 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
    'frame-src': ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
  return {
    name: 'skillsphere-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env.VITE_API_URL)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: apiTarget,
          ws: true,
        },
      },
    },
  };
});
