import { findFirstByRegex, IP_REGEX, DOMAIN_REGEX, IPv6_REGEX, isLocalIpv4, HASH_REGEX, FILE_REGEX, addUniqueValuesToArray } from "../src";

// Regex tests
test('Tests finding regex matches', () => {
    const testStringIpv4 = `Two IP addresses:
        8.8.8.8
        9.9.9.9`
    expect(findFirstByRegex(testStringIpv4, IP_REGEX)).toBe('8.8.8.8');
    expect(findFirstByRegex(testStringIpv4, DOMAIN_REGEX)).toBe(null);

    const testStringIpv6 = `Two more IP addresses:
        2600:4::185
        1:2:3:4:5:6:7:8
        8.8.8.8`
    expect(findFirstByRegex(testStringIpv6, IPv6_REGEX)).toBe('2600:4::185');
});

test('Properly recognizes valid IPv4 addresses', () => {
    const validIp1 = '8.8.8.8';
    const validIp2 = '1.2.3.4';
    const invalidIp1 = '433.8.8.8';

    expect(validIp1).toMatch(IP_REGEX);
    expect(validIp2).toMatch(IP_REGEX);
    expect(invalidIp1).not.toMatch(IP_REGEX);
});

test('Properly recognizes valid IPv6 addresses', () => {
    const ipv6_1 = '1::';
    const ipv6_2 = '1::8';
    const ipv6_3 = '1::7:8';
    const ipv6_4 = '1::6:7:8';
    const ipv6_5 = '1::5:6:7:8';
    const ipv6_6 = '1::4:5:6:7:8';
    const invalidIpv6_1 = '11:24';

    expect(ipv6_1).toMatch(IPv6_REGEX);
    expect(ipv6_2).toMatch(IPv6_REGEX);
    expect(ipv6_3).toMatch(IPv6_REGEX);
    expect(ipv6_4).toMatch(IPv6_REGEX);
    expect(ipv6_5).toMatch(IPv6_REGEX);
    expect(ipv6_6).toMatch(IPv6_REGEX);
    expect(invalidIpv6_1).not.toMatch(IPv6_REGEX);
})

test('Recognizes local IPv4 addresses', () => {
    const local1 = isLocalIpv4('10.1.2.3');
    const local2 = isLocalIpv4('192.168.1.2');
    const local3 = isLocalIpv4('127.0.0.1');
    const local4 = isLocalIpv4('172.16.2.3');
    const local5 = isLocalIpv4('172.31.2.3');
    const notLocal1 = isLocalIpv4('8.8.8.8');
    const notLocal2 = isLocalIpv4('8.10.8.8');

    expect(local1).toBe(true);
    expect(local2).toBe(true);
    expect(local3).toBe(true);
    expect(local4).toBe(true);
    expect(local5).toBe(true);
    expect(notLocal1).toBe(false);
    expect(notLocal2).toBe(false);
});

test('Recognizes hashes separated by non-whitespace characters', () => {
    const test1 = `1DB2D73D2F341ED85551FC341F88E6AB33BEE543C706C9B53469739E3A83FA50,1DB2D73D2F341ED85551FC341F88E6AB33BEE543C706C9B53469739E3A83FA50,1DB2D73D2F341ED85551FC341F88E6AB33BEE543C706C9B53469739E3A83FA50`;
    expect(test1.match(HASH_REGEX)?.length).toBe(3);
});

test('Recognizes file names', () => {
    const test1 = `
    C:\\asdf.txt + C:\\Windows\\system32\\explorer.exe
    D:\\fffffff.exe`;
    console.log(test1);
    expect(test1.match(FILE_REGEX)?.length).toBe(3);
});

test('Does not capture preceding url-encoded characters', () => {
    const test1 = "https%3A%2F%2Fwww%2Evirustotal.com%2Fgui%2Fdomain%2Fgoogle.com";
    const results1 = test1.matchAll(DOMAIN_REGEX);
    const actualResults = addUniqueValuesToArray([], results1);
    expect(actualResults.length).toBe(2);
    console.log(actualResults);
    expect(actualResults[0]).toBe('virustotal.com');
    expect(actualResults[1]).toBe('google.com');
})