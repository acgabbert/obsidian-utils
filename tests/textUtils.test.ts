import { defangDomain, defangEmail, defangIp, friendlyDatetime } from "../src";

// Defang functions
test('Defangs IP address', () => {
    const ip1 = defangIp('8.8.8.8');
    expect(ip1).toBe('8.8.8[.]8');
    // don't double-defang
    const ip2 = defangIp('8.8.8[.]8');
    expect(ip2).toBe('8.8.8[.]8');
});
test('Defangs email address', () => {
    const email1 = defangEmail('aaron@gabbert.me');
    expect(email1).toBe('aaron[@]gabbert[.]me');
});
test('Defangs domain', () => {
    const domain1 = defangDomain('google.com');
    expect(domain1).toBe('google[.]com');
    const domain2 = defangDomain('google.co.uk');
    expect(domain2).toBe('google.co[.]uk');
    // don't double-defang
    const domain3 = defangDomain(domain2);
    expect(domain3).toBe('google.co[.]uk');
});
test('Defangs URL', () => {
    const url1 = defangDomain('https://google.com');
    expect(url1).toBe('hxxps[://]google[.]com');
});

// Other transformations
test('Friendly prints date/time (e.g. "[DATE] at [TIME]")', () => {
    const datetime = friendlyDatetime('2024-09-09 09:09:09 UTC');
    expect(datetime).toBe('2024-09-09 at 09:09:09 UTC');
})