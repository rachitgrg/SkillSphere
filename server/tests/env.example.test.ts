import fs from 'fs';
import path from 'path';
import { schema } from '../src/config/env';

const keysIn = (file: string) =>
  new Set(
    fs
      .readFileSync(path.resolve(__dirname, file), 'utf8')
      .split(/\r?\n/)
      .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
      .filter((key): key is string => Boolean(key))
  );

describe('.env.example (P3-1)', () => {
  const documented = keysIn('../../.env.example');

  it('lists every variable the server reads', () => {
    const missing = Object.keys(schema.shape).filter((key) => !documented.has(key));
    expect(missing).toEqual([]);
  });

  it('lists nothing the server and seed script do not read', () => {
    const known = new Set([...Object.keys(schema.shape), 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD', 'SEED_DEMO_PASSWORD']);
    expect([...documented].filter((key) => !known.has(key))).toEqual([]);
  });

  it('client/.env.example documents VITE_API_URL', () => {
    expect(keysIn('../../client/.env.example').has('VITE_API_URL')).toBe(true);
  });
});
