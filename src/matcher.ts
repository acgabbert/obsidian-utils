import { DOMAIN_REGEX, FILE_REGEX, IP_REGEX, IPv6_REGEX, LOCAL_IP_REGEX, MACRO_REGEX, MD5_REGEX, SHA1_REGEX, SHA256_REGEX } from "./regex";

export const PATTERN_KEYS = ['IPv6', 'IP', 'IPv4', 'LocalIP', 'Domain', 'SHA256', 'MD5', 'SHA1', 'File'];
export type PatternKey = typeof PATTERN_KEYS[number];

export class Matcher {
    private static readonly Patterns: Record<PatternKey, string> = {
        IPv6: IPv6_REGEX.source,
        IPv4: IP_REGEX.source,
        IP: IP_REGEX.source,
        LocalIP: LOCAL_IP_REGEX.source,
        LocalIPv4: LOCAL_IP_REGEX.source,
        Domain: DOMAIN_REGEX.source,
        SHA256: SHA256_REGEX.source,
        MD5: MD5_REGEX.source,
        SHA1: SHA1_REGEX.source,
        File: FILE_REGEX.source,
        Macro: MACRO_REGEX.source
    } as const;

    static getAvailablePatterns(): readonly PatternKey[] {
        return PATTERN_KEYS;
    }

    static getExactMatcher(pattern: PatternKey): RegExp {
        return new RegExp(`^${Matcher.Patterns[pattern]}$`, 'i');
    }

    static getGlobalMatcher(pattern: PatternKey): RegExp {
        return new RegExp(Matcher.Patterns[pattern], 'gi');
    }

    static findAll(text: string, pattern: PatternKey): string[] {
        return Array.from(text.matchAll(this.getGlobalMatcher(pattern)), m => m[0]);
    }

    static isMatch(text: string, pattern: PatternKey): boolean {
        return this.getExactMatcher(pattern).test(text);
    }

    static findFirst(text: string, pattern: PatternKey): string | null {
        const match = text.match(Matcher.Patterns[pattern]);
        return match ? match[0] : null;
    }
}