import { addUniqueValuesToArray, Code, constructMacroRegex, defangDomain, defangEmail, defangIp, extractMacros, friendlyDatetime, parseCodeBlocks, removeArrayDuplicates, replaceMacros, validateDomain, validateDomains } from "../src";

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

// Other transformations
test('Friendly prints date/time (e.g. "[DATE] at [TIME]")', () => {
    const datetime = friendlyDatetime('2024-09-09 09:09:09 UTC');
    expect(datetime).toBe('2024-09-09 at 09:09:09 UTC');
});

test('Validates TLDs', () => {
    const validTld = ['COM', 'ORG', 'ME', 'INFO'];
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