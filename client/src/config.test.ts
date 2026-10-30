import { describe, expect, it } from 'vitest';
import { iceServersFrom } from './config';

describe('WebRTC ICE servers (P3-11)', () => {
  it('uses STUN only when no TURN server is configured', () => {
    expect(iceServersFrom({})).toEqual([{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]);
  });

  it('adds a TURN relay with its credentials', () => {
    const servers = iceServersFrom({ VITE_TURN_URL: 'turn:turn.example.com:3478, turns:turn.example.com:5349', VITE_TURN_USERNAME: 'u', VITE_TURN_CREDENTIAL: 'p' });
    expect(servers).toHaveLength(2);
    expect(servers[1]).toEqual({ urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'], username: 'u', credential: 'p' });
  });
});
