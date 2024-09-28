import { 
    Code,
    constructMacroRegex,
    defangDomain,
    defangEmail,
    defangIp,
    DOMAIN_REGEX,
    extractMacros,
    findFirstByRegex,
    folderPrefs,
    friendlyDatetime,
    getValidTld,
    IP_REGEX,
    IPv6_REGEX,
    isLocalIpv4,
    localDateTime,
    lowerMd5,
    lowerSha256,
    parseCodeBlocks,
    refangIoc,
    removeArrayDuplicates,
    replaceMacros,
    todayFolderStructure,
    todayLocalDate,
    validateDomain,
    validateDomains
} from "../src";

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
    /*
    // don't double-defang
    const domain3 = defangDomain(domain2);
    expect(domain3).toBe('google.co[.]uk');
    */
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

// Macro tests
test('Tests replacement of macros', () => {
    const macros = new Map<string, string>();
    macros.set('{{user}}', 'acgabbert');
    macros.set('{{file}}', 'testFile.dmg');
    const script = 'ls /Users/{{user}}/Downloads/{{file}}'
    const result1 = replaceMacros(script, macros);
    expect(result1).toBe('ls /Users/acgabbert/Downloads/testFile.dmg');
});

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

    const domains1 = ['asdf.com', 'questions.info', 'google.com', 'facebook.org', 'gabbert.me', 'asdf.qwerty'];
    const result5 = validateDomains(domains1, validTld);
    expect(result5).toEqual(['asdf.com', 'questions.info', 'google.com', 'facebook.org', 'gabbert.me']);

    // Validate TLDs of defanged domains
    const result6 = validateDomain('google[.]com', validTld);
    expect(result6).toBe(true);
    
    const domains2 = ['asdf.com', 'questions[.]info', 'google[.]com', 'facebook.org', 'gabbert.me', 'asdf[.]qwerty'];
    const result7 = validateDomains(domains2, validTld);
    expect(result7).toEqual(['asdf.com', 'questions[.]info', 'google[.]com', 'facebook.org', 'gabbert.me']);
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

test('Tests proper formatting of date strings', () => {
    const dateTest = /\d{4}-\d{2}-\d{2}/.exec(todayLocalDate());
    expect(dateTest).toBeTruthy();

    const dateTimeTest = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.exec(localDateTime());
    expect(dateTimeTest).toBeTruthy();
})

test('Tests proper folder structure', () => {
    const prefs: folderPrefs = {
        year: true,
        quarter: false,
        month: false,
        day: false
    };
    const structure1 = todayFolderStructure(prefs);
    expect(structure1.length).toBe(1);
    prefs.day = true;
    const structure2 = todayFolderStructure(prefs);
    expect(structure2.length).toBe(2);
    prefs.month = true;
    const structure3 = todayFolderStructure(prefs);
    expect(structure3.length).toBe(3);
    prefs.quarter = true;
    const structure4 = todayFolderStructure(prefs);
    expect(structure4.length).toBe(4);
})