import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { absoluteSocialMeta, resolvePublicUrl } from './socialMeta';

const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

describe('social meta tags (P3-10)', () => {
  it('makes og:image absolute and adds og:url and twitter:image', () => {
    const html = absoluteSocialMeta(indexHtml, 'https://skillsphere.example.app/');
    expect(html).toContain('<meta property="og:image" content="https://skillsphere.example.app/og-image.png" />');
    expect(html).toContain('<meta property="og:url" content="https://skillsphere.example.app/" />');
    expect(html).toContain('<meta name="twitter:image" content="https://skillsphere.example.app/og-image.png" />');
    expect(html).not.toContain('content="/og-image.png"');
  });

  it('takes the URL from VITE_PUBLIC_URL, then Netlify, then Vercel', () => {
    expect(resolvePublicUrl({ VITE_PUBLIC_URL: 'https://a.dev', URL: 'https://b.dev' })).toBe('https://a.dev');
    expect(resolvePublicUrl({ URL: 'https://b.dev' })).toBe('https://b.dev');
    expect(resolvePublicUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'c.vercel.app' })).toBe('https://c.vercel.app');
    expect(resolvePublicUrl({})).toBeUndefined();
  });
});
