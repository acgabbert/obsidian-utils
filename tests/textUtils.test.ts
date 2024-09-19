import { addUniqueValuesToArray, Code, constructMacroRegex, defangDomain, defangEmail, defangIp, DOMAIN_REGEX, extractMacros, findFirstByRegex, friendlyDatetime, getValidTld, IP_REGEX, isLocalIp, lowerMd5, lowerSha256, parseCodeBlocks, refangIoc, removeArrayDuplicates, replaceMacros, validateDomain, validateDomains } from "../src";

// Defang/Re-fang functions
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

test('Refangs IOCs', () => {
    const domain1 = refangIoc('google[.]com');
    expect(domain1).toBe('google.com');
    const url1 = refangIoc('hxxps[://]www.google[.]com/xyz');
    expect(url1).toBe('https://www.google.com/xyz');
    const ip1 = refangIoc('8.8.8[.]8');
    expect(ip1).toBe('8.8.8.8');
});

// Text extraction functions
test('Extracts macros', () => {
    const macros1 = extractMacros(`{{user}} macro
        {{host}} another macro`);
    expect(macros1.sort()).toEqual(['{{user}}', '{{host}}'].sort())
});

test('Extracts code blocks', () => {
    const codeBlocks = parseCodeBlocks(`# Test Code
\`\`\`powershell
Get-ChildItem {{file}}
\`\`\`
`);
    const results = [...codeBlocks];
    const result1: Code = {content: 'Get-ChildItem {{file}}', lang: 'powershell'};
    const expectedResults = [['Test Code', result1]]
    expect(results.sort()).toEqual(expectedResults)
});

test('Recognizes local IPv4 addresses', () => {
    const local1 = isLocalIp('10.1.2.3');
    const local2 = isLocalIp('192.168.1.2');
    const local3 = isLocalIp('127.0.0.1');
    const local4 = isLocalIp('172.16.2.3');
    const local5 = isLocalIp('172.31.2.3');
    const notLocal1 = isLocalIp('8.8.8.8');

    expect(local1).toBe(true);
    expect(local2).toBe(true);
    expect(local3).toBe(true);
    expect(local4).toBe(true);
    expect(local5).toBe(true);
    expect(notLocal1).toBe(false);
})

// Macro tests
test('Tests replacement of macros', () => {
    const macros = new Map<string, string>();
    macros.set('{{user}}', 'acgabbert');
    macros.set('{{file}}', 'testFile.dmg');
    const script = 'ls /Users/{{user}}/Downloads/{{file}}'
    const result1 = replaceMacros(script, macros);
    expect(result1).toBe('ls /Users/acgabbert/Downloads/testFile.dmg');
})

test('Tests construction of macro regex', () => {
    const result1 = constructMacroRegex('file');
    expect(result1).toEqual(/file(?:\s*[:=]\s*|\s+)(((?:[^}\s]*\w[^}\s]*)+))/gi);
    const result2 = constructMacroRegex(/(user|account)/i);
    expect(result2).toEqual(/(user|account)(?:\s*[:=]\s*|\s+)(((?:[^}\s]*\w[^}\s]*)+))/gi);
});

// Regex tests
test('Tests finding regex matches', () => {
    const testString = `Two IP addresses:
        8.8.8.8
        9.9.9.9`
    expect(findFirstByRegex(testString, IP_REGEX)).toBe('8.8.8.8');
    expect(findFirstByRegex(testString, DOMAIN_REGEX)).toThrow("No matches from the provided regex.");
})

// Other transformations
test('Friendly prints date/time (e.g. "[DATE] at [TIME]")', () => {
    const datetime = friendlyDatetime('2024-09-09 09:09:09 UTC');
    expect(datetime).toBe('2024-09-09 at 09:09:09 UTC');
});

test('Validates TLDs', async () => {
    let validTld = await getValidTld();
    //if (!validTld) validTld = ['COM', 'ORG', 'ME', 'INFO'];
    if (!validTld) return;
    const result1 = validateDomain('google.com', validTld);
    const result2 = validateDomain('testdomain.org', validTld);
    const result3 = validateDomain('gabbert.me', validTld);
    const result4 = validateDomain('asdf.qwerty', validTld);
    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(true);
    expect(result4).toBe(false);

    const domains = ['asdf.com', 'questions.info', 'google.com', 'facebook.org', 'gabbert.me', 'asdf.qwerty'];
    const result5 = validateDomains(domains, validTld);
    expect(result5).toEqual(['asdf.com', 'questions.info', 'google.com', 'facebook.org', 'gabbert.me'])
});

test('Tests removal of array duplicates', () => {
    const arrWithDupes = ['yes', 'yes', 'no', 'asdf'];
    const result1 = removeArrayDuplicates(arrWithDupes);
    expect(result1).toEqual(['yes', 'no', 'asdf']);
});

test('Tests other transformation of various IOCs', () => {
    const sha256upper = '1DB2D73D2F341ED85551FC341F88E6AB33BEE543C706C9B53469739E3A83FA50';
    const md5upper = 'D01726DBB7CA105A949C85E30618A390';
    const notAHash = 'D01726DBB7CA105A949C85E30618A39Z';
    expect(lowerMd5(md5upper)).toBe('d01726dbb7ca105a949c85e30618a390');
    expect(lowerSha256(sha256upper)).toBe('1db2d73d2f341ed85551fc341f88e6ab33bee543c706c9b53469739e3a83fa50');
    expect(lowerMd5(lowerSha256(notAHash))).toBe(notAHash);
})