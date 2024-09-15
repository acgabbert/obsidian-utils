import { defangDomain, defangEmail, defangIp } from "../src";

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