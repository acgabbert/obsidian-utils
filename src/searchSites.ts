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
    sites: searchSite[] | undefined;
}

export interface searchSite {
    name: string
    shortName: string
    site: string
    ip: boolean
    hash: boolean
    domain: boolean
    multisearch: boolean
    separator?: string
    enabled: boolean
}

export const vtSearch: searchSite = {
    name: 'VirusTotal',
    shortName: 'VT',
    site: VT_SEARCH,
    ip: true,
    hash: true,
    domain: true,
    multisearch: true,
    separator: '%20',
    enabled: true
}

export const ipdbSearch: searchSite = {
    name: 'AbuseIPDB',
    shortName: 'IPDB',
    site: IPDB_SEARCH,
    ip: true,
    hash: false,
    domain: true,
    multisearch: false,
    enabled: true
}

export const googleSearch: searchSite = {
    name: 'Google',
    shortName: 'Google',
    site: GOOGLE_SEARCH,
    ip: true,
    hash: true,
    domain: true,
    multisearch: false,
    enabled: true
}

export const urlscanSearch: searchSite = {
    name: 'URLScan',
    shortName: 'URLScan',
    site: URLSCAN_SEARCH,
    ip: true,
    hash: false,
    domain: true,
    multisearch: false,
    enabled: false
}

export const IP_EXCLUSIONS = ["127.0.0.1"]
export const DOMAIN_EXCLUSIONS = ["google.com"]

export const defaultSites: searchSite[] = [vtSearch, ipdbSearch, googleSearch];