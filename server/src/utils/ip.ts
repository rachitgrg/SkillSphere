import { BlockList, isIP } from 'net';

/**
 * Addresses many unrelated people can share: loopback, private (RFC 1918, fc00::/7), link-local,
 * carrier-grade NAT and "this network". A match on one of these says nothing about who is behind it.
 */
const nonPublic = new BlockList();
nonPublic.addSubnet('0.0.0.0', 8, 'ipv4');
nonPublic.addSubnet('10.0.0.0', 8, 'ipv4');
nonPublic.addSubnet('100.64.0.0', 10, 'ipv4');
nonPublic.addSubnet('127.0.0.0', 8, 'ipv4');
nonPublic.addSubnet('169.254.0.0', 16, 'ipv4');
nonPublic.addSubnet('172.16.0.0', 12, 'ipv4');
nonPublic.addSubnet('192.168.0.0', 16, 'ipv4');
nonPublic.addAddress('::', 'ipv6');
nonPublic.addAddress('::1', 'ipv6');
nonPublic.addSubnet('fc00::', 7, 'ipv6');
nonPublic.addSubnet('fe80::', 10, 'ipv6');

/** True for a routable address that can tell users apart; false for private/loopback/invalid input. */
export const isPublicIp = (ip: string | null | undefined): boolean => {
  if (!ip) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip); // IPv4-mapped IPv6, as req.ip reports it
  const address = mapped ? mapped[1] : ip;
  const family = isIP(address);
  if (family === 0) return false;
  return !nonPublic.check(address, family === 4 ? 'ipv4' : 'ipv6');
};
