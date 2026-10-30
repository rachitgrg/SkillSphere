/**
 * Build-time helper (used by vite.config.ts): social crawlers ignore relative URLs, so og:image
 * becomes absolute and og:url / twitter:image are added once the site's public URL is known.
 */
export const absoluteSocialMeta = (html: string, publicUrl: string): string => {
  const base = publicUrl.trim().replace(/\/+$/, '');
  const image = `${base}/og-image.png`;
  return html
    .replace('<meta property="og:image" content="/og-image.png" />', `<meta property="og:image" content="${image}" />`)
    .replace(
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta property="og:url" content="${base}/" />\n    <meta name="twitter:card" content="summary_large_image" />\n    <meta name="twitter:image" content="${image}" />`
    );
};

/** The deployed site's URL: VITE_PUBLIC_URL, else what Netlify or Vercel provide at build time. */
export const resolvePublicUrl = (env: Record<string, string | undefined>): string | undefined => {
  if (env.VITE_PUBLIC_URL) return env.VITE_PUBLIC_URL;
  if (env.URL) return env.URL; // Netlify
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return undefined;
};
