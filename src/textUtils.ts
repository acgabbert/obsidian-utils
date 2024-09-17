import { type RequestUrlParam, TFile, request } from "obsidian";
import type { Code } from "./modal";
export {
    addUniqueValuesToArray,
    constructMacroRegex,
    convertTime,
    defangIp,
    defangDomain,
    defangEmail,
    extractMacros,
    extractMatches,
    findFirstByRegex,
    friendlyDatetime,
    getValidTld,
    lowerSha256,
    lowerMd5,
    parseCodeBlocks,
    refangIoc,
    removeArrayDuplicates,
    replaceMacros,
    replaceTemplateText,
    todayLocalDate,
    todayFolderStructure,
    validateDomain,
    validateDomains
}

// regex for possibly defanged values
export const IP_REGEX = /(\d{1,3}\[?\.\]?\d{1,3}\[?\.\]?\d{1,3}\[?\.\]?\d{1,3})/gi;
export const DOMAIN_REGEX = /((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.|\[\.\]))+[a-zA-Z][a-zA-Z0-9-]{0,61}[a-zA-Z](?=\.?)\b)/gi;
export const HASH_REGEX = /(?:^|[^a-fA-F0-9]+)([a-fA-F0-9]{64}|[a-fA-F0-9]{40}|[a-fA-F0-9]{32})(?:$|[^a-fA-F0-9]+)/gi;
export const FILE_REGEX = /(?:^|\s|")((\w:\\|[\\/])[^\\/]+[\\/]([^\\/\n"|]+[\\/]?)+(\.\w+)?)/gi;

export const TLD_URL = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt';

/**
 * Get a list of valid top-level domains from IANA.
 * @returns a promise with the list of valid strings, or null if failed.
 */
async function getValidTld(): Promise<string[] | null> {
    const tldParams = {url: 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt', throw: true} as RequestUrlParam;
    try {
        const data = await request(tldParams);
        const tlds = data.split('\n');
        if (tlds[0].startsWith('#')) tlds.shift(); // first line comment
        if (!tlds.slice(-1)[0]) tlds.pop(); // last line empty string
        return tlds;
    } catch (e) {
        console.log('failed to get valid TLDs');
        console.log(e);
        return null;
    }
}

/**
 * @returns current local date as a string in format YYYY-MM-DD
 */
function todayLocalDate(): string {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
    const date = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
    return date;
}

/**
 * @returns the local date/time in format `YYYY-MM-DD HH:SS`
 */
function localDateTime() {
    return `${todayLocalDate()} ${new Date(Date.now()).toString().slice(16, 21)}`
}

export interface folderPrefs {
    year: boolean,
    month: boolean,
    quarter: boolean,
    day: boolean
}

/**
 * Returns a string with the folder structure for the current date
 * Format: `YYYY/YYYY-QQ/YYYY-MM/YYYY-MM-DD`
 * 
 * @param quarter - Boolean specifying whether to include quarter (YYYY-QQ) in the folder structure
 * @returns the folder structure for the current date
 */
function todayFolderStructure(prefs: folderPrefs): Array<string> {
    const date = todayLocalDate();
    const year = date.slice(0,4);
    const month = Number(date.slice(5,7));
    const yearMonth = date.slice(0,7);
    const currentQuarter = Math.floor((month + 2) / 3);
    const folderArray = [];
    if (prefs.year) folderArray.push(year);
    if (prefs.quarter) folderArray.push(`${year}-Q${currentQuarter}`);
    if (prefs.month) folderArray.push(yearMonth);
    if (prefs.day) folderArray.push(date);
    return folderArray;
}

/**
 * Defangs IP addresses, e.g. `8.8.8.8` becomes `8.8.8[.]8`
 * @param text a string containing IP addresses
 * @returns input string with IP addresses defanged
 */
function defangIp(text: string): string {
    return text.replaceAll(/(\d{1,3}\.\d{1,3}\.\d{1,3})\.(\d{1,3})/g, "$1[.]$2");
}

/**
 * Defangs domains preceded with http(s), e.g. `https://google.com` 
 * becomes `hxxps[://]google[.]com`
 * @param text a string containing domain names
 * @returns input string with domains defanged
 */
function defangDomain(text: string): string {
    const httpString = /http(s?):\/\//gi;
    const anyDomain = /(([\w-]\.?)+)\.((xn--)?([a-z][a-z0-9-]{1,60}|[a-z][a-z0-9-]{1,29}\.[a-z]{2,}))/gi;
    let retval = text.replaceAll(httpString, "hxxp$1[://]");
    retval = retval.replaceAll(anyDomain, "$1[.]$3");
    return retval;
}

/**
 * Defangs email addresses
 * @param text a string containing email addresses
 * @returns input string with email addresses defanged
 */
function defangEmail(text: string): string {
    const emailString = /([^\s]+)@([^\s]+)\.([^\s]+)/gi;
    const retval = text.replaceAll(emailString, "$1[@]$2[.]$3");
    return retval;
}

/**
 * refang an IOC (domain, URL, IP address)
 * @param text a string with defanged IOC(s)
 * @returns the string with IOCs re-fanged
 */
function refangIoc(text: string): string {
    let retval = text.replaceAll('[.]', '.');
    retval = retval.replaceAll('hxxp', 'http');
    retval = retval.replaceAll('[:]', ':');
    retval = retval.replaceAll('[://]', '://');
    retval = retval.toLowerCase();
    return retval;
}

/**
 * Converts SHA256 hashes (or any 64 character hex string) to lowercase
 * @param text a string
 * @returns input string with SHA256 hashes converted to lowercase
 */
function lowerSha256(hash: string): string {
    return hash.replace(/([0-9a-fA-F]{64})/g, function(match) {
        return match.toLowerCase();
    });
}

/**
 * Converts MD5 hashes (or any 32 character hex string) to lowercase
 * @param text a string
 * @returns input string with MD5 hashes converted to lowercase
 */
function lowerMd5(text: string): string {
    return text.replace(/([0-9a-fA-F]{32})/g, function(match) {
        return match.toLowerCase();
    });
}

export const dateTimeRegex = /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\s+UTC)/g;
/**
 * Converts a datetime string in the format `YYYY-MM-DD HH:MM:SS UTC`
 * to the following: `YYYY-MM-DD at HH:MM:SS UTC`
 * @returns input string with datetimes converted to "{date} at {time}"
 */
function friendlyDatetime(text: string): string {
    return text.replace(dateTimeRegex, "$1 at $2");
}

/**
 * Find the first match of a regex in the given string.
 * @param text the text to search
 * @param regex the regular expression to match
 * @returns first match of a regex in the given string
 */
function findFirstByRegex(text: string, regex: RegExp): string {
    const result = regex.exec(text);
    if (!result) {
        throw Error;
    } else {
        return result[1]
    }
}

/**
 * Put a template around the given content.
 * Supported macros: 
 * - {{title}} the note title
 * - {{date}} the date in format YYYY-MM-DD
 * - {{time}} the time in format HH:SS
 * - {{content}} the content you want to replace'
 * @param template the template
 * @param content the content
 * @param note the note to which it will be inserted
 * @param contentMacro the string to replace content with @default "{{content}}"
 */
function replaceTemplateText(template: string, content: string, note: TFile, contentMacro = "{{content}}") {
    let template_replaced = template.replaceAll("{{title}}", note.name.slice(0, -3));
    const dateTime = localDateTime().split(" ");
    template_replaced = template_replaced.replaceAll("{{date}}", dateTime[0]);
    template_replaced = template_replaced.replaceAll("{{time}}", dateTime[1]);
    template_replaced = template_replaced.replaceAll(contentMacro, content);
    return template_replaced;
}

export const MACRO_REGEX = /({{([^}]+)}})/g;
/**
 * Extract macros in the format {{macro}}
 * @param text
 * @returns a unique list of macros in the text
 */
function extractMacros(text: string): string[] {
    const regexTest = new RegExp(MACRO_REGEX.source, MACRO_REGEX.flags);
    const matches = text.matchAll(regexTest);
    return addUniqueValuesToArray([], matches);
}

/**
 * Extracts matches for all of the given regular expressions.
 * @param text the text to check against
 * @param pattern the regex pattern(s) to evaluate
 * @returns an array of strings that matched the given regex
 */
function extractMatches(text: string, pattern: RegExp | RegExp[]): string[] {
    if (Array.isArray(pattern)) {
        const matches: string[] = [];
        pattern.forEach((value) => {
            addUniqueValuesToArray(matches, text.matchAll(value));
        });
        return matches;
    } else {
        const matches = text.matchAll(pattern);
        return addUniqueValuesToArray([], matches);
    }
}

/**
 * Replace (1:1) keys with their associated values in the provided text.
 * @param text the text in which to replace
 * @param replacements the map of keys to values
 * @returns the input with replaced text
 */
function replaceMacros(text: string, replacements: Map<string, string>): string {
    let retval = text;
    replacements.forEach((value, key) => {
        retval = retval.replaceAll(key, value);
    });
    return retval;
}

/**
 * Add unique values from the passed RegExpMatchArray to the given array of strings
 * @param array an array of strings
 * @param values a set of regex matches
 * @returns the passed array with unique values added
 */
function addUniqueValuesToArray(array: string[], values: IterableIterator<RegExpMatchArray>): string[] {
    const valueArray = [...values];
    valueArray.forEach((match) => {
        if (!array.includes(match[1])) {
            array.push(match[1]);
        }
    });
    return array;
}


/**
 * Parse code blocks and the headers before them
 * @param content file content
 * @returns a mapping of headers to code block content
 */
function parseCodeBlocks(content: string): Map<string, Code> {
    const retval = new Map();
    const codeBlockRegex = /#+\s+(.+)$\n+```([\w-_\s]*)\n(((?!^```\n).|\n)*)\n^```$/gm;
    const matches = content.matchAll(codeBlockRegex);
    const matchArray = [...matches];
    matchArray.forEach((match) => {
        if (!retval.has(match[1])) {
            const code: Code = {
                content: match[3],
                lang: match[2]
            };
            retval.set(match[1], code);
        }
    });
    return retval;
}

export const macroSeparator = "(?:\\s*[:=]\\s*|\\s+)";
export const macroValue = "(((?:[^}\\s]*\\w[^}\\s]*)+))";
/**
 * Constructs a regular expression to match values in the note based on the passed values
 * and separator constants above
 * @param macroRegex the macro name (like file, user, etc)
 * @returns the constructed regular expression
 */
function constructMacroRegex(macroRegex: string | RegExp): RegExp {
    if (macroRegex instanceof RegExp) macroRegex = macroRegex.source;
    const retval = new RegExp(macroRegex + macroSeparator + macroValue, "gi");
    return retval;
}

/**
 * Validate a domain against a list of valid top-level domains (TLD)
 * @param domain the domain to validate
 * @param validTld an array of valid TLD strings in uppercase
 * @returns the boolean representation of the domain's validity
 */
function validateDomain(domain: string, validTld: string[]): boolean {
    const tld = domain.split('.').pop()?.toUpperCase();
    if (tld && validTld.includes(tld)) return true;
    return false;
}

/**
 * Removes duplicates from the passed array.
 * @param array an array of strings
 * @returns the array with duplicates removed
 */
function removeArrayDuplicates(array: string[]): string[] {
    return array.filter((item, index) => {
        return array.indexOf(item) === index;
    });
}

function convertTime(timeString: string): number {
    return Date.parse(timeString);
}

/**
 * Validate a list of domains against a list of valid top-level domains (TLD)
 * @param domains a list of domains to validate
 * @param validTld a list of valid TLDs
 * @returns domains with valid TLDs
 */
function validateDomains(domains: string[], validTld: string[]): string[] {
    let index = domains.length - 1;
    while (index >= 0) {
        const domain = domains[index];
        if (!validateDomain(domain, validTld)) {
            domains.splice(index, 1);
        }
        index -= 1;
    }
    return domains;
}