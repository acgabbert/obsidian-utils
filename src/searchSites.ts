export const VT_SEARCH = 'https://virustotal.com/gui/search/%s';
export const IPDB_SEARCH = 'https://abuseipdb.com/check/%s';
export const GOOGLE_SEARCH = 'https://google.com/search?q=%s';
export const URLSCAN_SEARCH = 'https://urlscan.io/search/#%s';
export const SPUR_SEARCH = 'https://app.spur.us/context?q=%s';
export const SHODAN_SEARCH = 'https://www.shodan.io/host/%s';
export const CENSYS_SEARCH = 'https://search.censys.io/hosts/%s';

export interface ParsedIndicators {
    title: string;
    items: string[];
    sites: SearchSite[] | undefined;
}

export interface SearchSite {
    name: string
    shortName: string
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
    ip: true,
    ipv6: true,
    hash: false,
    domain: true,
    multisearch: false,
    enabled: true
}

export const googleSearch: SearchSite = {
    name: 'Google',
    shortName: 'Google',
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
    site: URLSCAN_SEARCH,
    ip: true,
    ipv6: true,
    hash: false,
    domain: true,
    multisearch: false,
    enabled: false
}

export const IP_EXCLUSIONS = ["127.0.0.1"]
export const DOMAIN_EXCLUSIONS = ["google.com"]

export const defaultSites: SearchSite[] = [
    vtSearch,
    ipdbSearch,
    googleSearch,
    urlscanSearch
];