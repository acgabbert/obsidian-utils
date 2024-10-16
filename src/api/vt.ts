import { request, RequestUrlParam } from "obsidian";
import { getIocType } from "..";

const vtBaseUrl = "https://www.virustotal.com/api/v3/";

export const vtDefaultTemplate = 
`asdf
asdf
`;

export type VtResponse = {
    id: string
    type: string
    links: Record<string, string>
    attributes: VtAttributes
}

export interface VtFileResponse extends VtResponse {
    attributes: VtFileAttributes
}

export interface VtDomainResponse extends VtResponse {
    attributes: VtDomainAttributes
}

export interface VtIpResponse extends VtResponse {
    attributes: VtIpAttributes
}

export interface VtAttributes {
    total_votes: Record<string, number>
    last_analysis_date?: number
    last_analysis_results: Record<string, VtAnalysisResult>
    last_analysis_stats: Record<string, number>
}

export interface VtFileAttributes extends VtAttributes {
    magic: string,
    type_description: string,
    crowdsourced_yara_results: YaraResult[]
    md5: string
    names: string[]
    packers: Record<string, string>
    sha1: string
    sha256: string
    size: number
    tags: string[]
    type_tag: string
    type_tags: string[]
    detectiteasy?: {
        filetype: string,
        values: {
            type: string,
            name: string,
            info?: string,
            version?: string
        }[]
    }
}

export interface VtDomainAttributes extends VtAttributes {
    total_votes: Record<string, number>
    jarm: string
    whois_date: number
    tld: string
    last_dns_records: Array<VtDnsRecord>
    last_https_certificate_date: number
    categories: Record<string, string>
    whois: string
    popularity_ranks: Record<string, VtDomainPopularity>
    last_dns_records_date: number
    last_https_certificate: Record<string, unknown>
    creation_date: number
}

type VtDnsRecord = {
    type: string
    ttl: number
    value: string
}

type VtAnalysisResult = {
    method: string
    engine_name: string
    engine_version?: string
    engine_update?: string
    category: string
    result: string
}

type VtDomainPopularity = {
    timestamp: number
    rank: number
}

type YaraResult = {
    ruleset_id: string
    rule_name: string
    ruleset_name: string
    description: string
    author: string
    source: string
}

export interface VtIpAttributes extends VtAttributes {
    whois: string,
    whois_date: number,
    country: string,
    as_owner: string,
    asn: number,
    regional_internet_registry: string
}

async function virusTotalRequest(val: string, key: string, template?: string): Promise<string | null> {
    val = val.trim().toLowerCase();
    let requestUrl = vtBaseUrl;
    switch(getIocType(val)) {
        case 'ip':
            requestUrl += `ip_addresses/${val}`;
            break;
        case 'domain':
            requestUrl += `domains/${val}`;
            break;
        case 'hash':
            requestUrl += `files/${val}`;
            break;
        case null:
            return null;
    }
    const headers = {'x-apikey': key};
    const vtParams = {url: requestUrl, headers: headers, throw: true} as RequestUrlParam;
    let data;
    try {
        data = await request(vtParams);
    } catch(err) {
        console.error(err);
        return "VirusTotal request failed.";
    }
    data = JSON.parse(data).data as VtResponse;
    if (!template) template = vtDefaultTemplate;
    const resp = vtTemplate(template, data);
    return resp;
}

function vtTemplate(template: string, vtObj: VtResponse) {

    return template;
}