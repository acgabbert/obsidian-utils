export const VT_SEARCH = 'https://virustotal.com/gui/search/%s';
export const IPDB_SEARCH = 'https://abuseipdb.com/check/%s';
export const GOOGLE_SEARCH = 'https://google.com/search?q="%s"';
export const DDG_SEARCH = 'https://duckduckgo.com/?q="%s"';
export const URLSCAN_SEARCH = 'https://urlscan.io/search/#%s';
export const SPUR_SEARCH = 'https://app.spur.us/context?q=%s';
export const SHODAN_SEARCH = 'https://www.shodan.io/host/%s';
export const CENSYS_SEARCH = 'https://search.censys.io/hosts/%s';

export type IndicatorExclusion = string | RegExp;

export interface ParsedIndicators {
    title: string;
    items: string[];
    sites: SearchSite[] | undefined;
    exclusions: IndicatorExclusion[];
}

export function filterExclusions(items: string[], exclusions: IndicatorExclusion[]): string[] {
    return items.filter(item => 
        !exclusions.some(exclusion => 
            typeof exclusion === 'string'
                ? item === exclusion
                : exclusion.test(item)
        )
    );
}

export interface SearchSite {
    name: string
    shortName: string
    description?: string
    site: string
    ip: boolean
    ipv6?: boolean
    hash: boolean
    domain: boolean
    multisearch: boolean
    separator?: string
    enabled: boolean
}

export const vtSearch: SearchSite = {
    name: 'VirusTotal',
    shortName: 'VT',
    description: 'VirusTotal inspects items with over 70 antivirus scanners and URL/domain blocklisting services.',
    site: VT_SEARCH,
    ip: true,
    ipv6: true,
    hash: true,
    domain: true,
    multisearch: true,
    separator: '%20',
    enabled: true
}

export const ipdbSearch: SearchSite = {
    name: 'AbuseIPDB',
    shortName: 'IPDB',
    site: IPDB_SEARCH,
    description: 'Check an IP address, domain name, or subnet to see if it\'s been reported.',
    ip: true,
    ipv6: true,
    hash: false,
    domain: true,
    multisearch: false,
    enabled: true
}

export const ddgSearch: SearchSite = {
    name: 'DuckDuckGo',
    shortName: 'DuckDuckGo',
    description: 'A general, privacy-focused web search engine.',
    site: DDG_SEARCH,
    ip: true,
    ipv6: true,
    hash: true,
    domain: true,
    multisearch: false,
    enabled: false
}

export const googleSearch: SearchSite = {
    name: 'Google',
    shortName: 'Google',
    description: 'A general web search engine.',
    site: GOOGLE_SEARCH,
    ip: true,
    ipv6: true,
    hash: true,
    domain: true,
    multisearch: false,
    enabled: true
}

export const urlscanSearch: SearchSite = {
    name: 'URLScan',
    shortName: 'URLScan',
    description: 'A free service to scan and analyze websites.',
    site: URLSCAN_SEARCH,
    ip: true,
    ipv6: true,
    hash: false,
    domain: true,
    multisearch: false,
    enabled: false
}

export const shodanSearch: SearchSite = {
    name: 'Shodan',
    shortName: 'Shodan',
    description: 'A search engine for internet-connected devices.',
    site: SHODAN_SEARCH,
    ip: true,
    ipv6: true,
    hash: false,
    domain: false,
    multisearch: false,
    enabled: false
}

export const censysSearch: SearchSite = {
    name: 'Censys',
    shortName: 'Censys',
    description: 'A database of internet intelligence.',
    site: CENSYS_SEARCH,
    ip: true,
    ipv6: true,
    hash: false,
    domain: true,
    multisearch: false,
    enabled: false
}

export const spurSearch: SearchSite = {
    name: 'Spur',
    shortName: 'Spur',
    description: 'Identifies VPN entry/exit, residential proxies, geo concentration, and more. Free account required to retrieve results.',
    site: SPUR_SEARCH,
    ip: true,
    ipv6: true,
    hash: false,
    domain: false,
    multisearch: false,
    enabled: false
}

export const IP_EXCLUSIONS = ["127.0.0.1"]
export const DOMAIN_EXCLUSIONS = ["google.com"]

export const defaultSites: SearchSite[] = [
    vtSearch,
    ipdbSearch,
    googleSearch,
    ddgSearch,
    urlscanSearch,
    shodanSearch,
    censysSearch,
    spurSearch
];