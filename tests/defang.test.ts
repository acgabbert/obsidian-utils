import { defangDomain, defangEmail, defangIp } from "../src";

test('Defangs IP address', () => {
    const ip = defangIp('8.8.8.8');
    expect(ip).toBe('8.8.8[.]8');
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
});