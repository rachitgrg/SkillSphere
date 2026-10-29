import { isPublicIp } from '../src/utils/ip';

describe('isPublicIp', () => {
  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.10', '169.254.1.1', '100.64.0.1', 'fd12::1', 'fe80::1', '::', '', 'not-an-ip', undefined, null])(
    '%p is not public',
    (ip) => expect(isPublicIp(ip)).toBe(false)
  );

  it.each(['203.0.113.9', '8.8.8.8', '172.32.0.1', '::ffff:198.51.100.1', '2001:4860:4860::8888'])('%p is public', (ip) =>
    expect(isPublicIp(ip)).toBe(true)
  );
});
