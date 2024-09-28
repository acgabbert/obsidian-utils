import { findFirstByRegex, IP_REGEX, DOMAIN_REGEX, IPv6_REGEX, isLocalIpv4 } from "../src";

// Regex tests
test('Tests finding regex matches', () => {
    const testStringIpv4 = `Two IP addresses:
        8.8.8.8
        9.9.9.9`
    expect(findFirstByRegex(testStringIpv4, IP_REGEX)).toBe('8.8.8.8');
    expect(findFirstByRegex(testStringIpv4, DOMAIN_REGEX)).toBe(null);

    const testStringIpv6 = `Two more IP addresses:
        1:2:3:4:5:6:7:8
        8.8.8.8`
    expect(findFirstByRegex(testStringIpv6, IPv6_REGEX)).toBe('1:2:3:4:5:6:7:8');
});

test('Properly recognizes valid IPv4 addresses', () => {
    const validIp1 = '8.8.8.8';
    const validIp2 = '1.2.3.4';
    const invalidIp1 = '433.8.8.8';

    expect(validIp1).toMatch(IP_REGEX);
    expect(validIp2).toMatch(IP_REGEX);
    expect(invalidIp1).not.toMatch(IP_REGEX);
})

test('Recognizes local IPv4 addresses', () => {
    const local1 = isLocalIpv4('10.1.2.3');
    const local2 = isLocalIpv4('192.168.1.2');
    const local3 = isLocalIpv4('127.0.0.1');
    const local4 = isLocalIpv4('172.16.2.3');
    const local5 = isLocalIpv4('172.31.2.3');
    const notLocal1 = isLocalIpv4('8.8.8.8');

    expect(local1).toBe(true);
    expect(local2).toBe(true);
    expect(local3).toBe(true);
    expect(local4).toBe(true);
    expect(local5).toBe(true);
    expect(notLocal1).toBe(false);
});