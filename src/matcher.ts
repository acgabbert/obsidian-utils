import { DOMAIN_REGEX, FILE_REGEX, IP_REGEX, IPv6_REGEX, LOCAL_IP_REGEX, MACRO_REGEX, MD5_REGEX, SHA1_REGEX, SHA256_REGEX } from "./regex";
import { filterExclusions, Indicator, IndicatorSource, IndicatorType, ParsedIndicators } from "./iocParser";
import { isLocalIpv4, refangIoc } from "./textUtils";
import { CyberPlugin } from "./cyberPlugin";

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


/**
 * Extract IOCs from the given file content.
 * @param fileContent content from which to extract IOCs
 * @returns an array of ParsedIndicators objects for each IOC type
 */
export function getMatches(fileContent: string): ParsedIndicators[] {
    if (!fileContent) return [];
    const ips: ParsedIndicators = {
        title: "IPs",
        items: Matcher.findAll(fileContent, 'IPv4')
    }
    const domains: ParsedIndicators = {
        title: "Domains",
        items: Matcher.findAll(fileContent, 'Domain')
    }
    const hashes: ParsedIndicators = {
        title: "Hashes",
        items: Matcher.findAll(fileContent, 'SHA256')
    }
    const privateIps: ParsedIndicators = {
        title: "IPs (Private)",
        items: []
    }
    const ipv6: ParsedIndicators = {
        title: "IPv6",
        items: Matcher.findAll(fileContent, 'IPv6')
    }
    ips.title = "IPs (Public)";
    for (let i = 0; i < ips.items.length; i++) {
        const item = ips.items[i];
        if(isLocalIpv4(item)) {
            ips.items.splice(i, 1);
            i--;
            privateIps.items.push(item);
        }
    }
    const retval = [ips, privateIps, domains, hashes, ipv6];

    // refang and de-duplicate IOCs
    retval.forEach((iocList, index, array) => {
        const refangedItems = iocList.items.map((x) => refangIoc(x));
        
        // remove duplicates using a set
        iocList.items = [...new Set(refangedItems)];
        array[index] = iocList;
    });
    return retval;
}

export function getIndicatorMatches(fileContent: string, source: IndicatorSource = IndicatorSource.TEXT, metadata?: Record<string, any>): Indicator[] {
    const indicators: Indicator[] = [];
    if (!fileContent) return indicators;

    const ipv4Addresses = Matcher.findAll(fileContent, 'IPv4');
    for (const ip of ipv4Addresses) {
        const refangedIp = refangIoc(ip);
        if (isLocalIpv4(refangedIp)) {
            indicators.push({
                value: refangedIp,
                type: IndicatorType.PRIVATE_IPv4,
                source,
                metadata
            });
        } else {
            indicators.push({
                value: refangedIp,
                type: IndicatorType.IPv4,
                source,
                metadata
            });
        }
    }

    const ipv6Addresses = Matcher.findAll(fileContent, 'IPv6');
    for (const ip of ipv6Addresses) {
        indicators.push({
            value: refangIoc(ip),
            type: IndicatorType.IPv6,
            source,
            metadata
        });
    }

    const domains = Matcher.findAll(fileContent, 'Domain');
    for (const domain of domains) {
        indicators.push({
            value: refangIoc(domain),
            type: IndicatorType.DOMAIN,
            source,
            metadata
        });
    }

    const sha256Hashes = Matcher.findAll(fileContent, 'SHA256');
    for (const hash of sha256Hashes) {
        indicators.push({
            value: hash,
            type: IndicatorType.HASH,
            source,
            metadata
        });
    }

    return indicators;
}

/**
 * Process exclusions for a list of IOCs.
 * @param plugin a CyberPlugin
 * @param indicators a list of parsed indicators
 * @returns indicators with exclusions applied
 */
export function processExclusions(iocs: ParsedIndicators[], plugin: CyberPlugin | undefined): ParsedIndicators[] {
    if (!iocs || !plugin) return iocs;
    const exclusions = plugin.getIocExclusions();
    
    return iocs.map(indicatorList => {
        // create a copy to avoid modifying the original
        const processed = { ...indicatorList };
        
        switch(processed.title) {
            case "IPs":
            case "IPs (Public)":
            case "IPs (Private)":
                processed.exclusions = exclusions.ipv4Exclusions || [];
                break;
            case "IPv6":
                processed.exclusions = exclusions.ipv6Exclusions || [];
                break;
            case "Domains":
                processed.exclusions = exclusions.domainExclusions || [];
                break;
            case "Hashes":
                processed.exclusions = exclusions.hashExclusions || [];
                break;
            default:
                processed.exclusions = [];
                break;
        }

        if (processed.exclusions && processed.exclusions.length > 0) {
            processed.items = filterExclusions(processed.items, processed.exclusions);
        }

        return processed;
    });
}