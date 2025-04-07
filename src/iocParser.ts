import { SearchSite } from "./searchSites";

export type IndicatorExclusion = string | RegExp;

export interface Indicator {
    value: string;
    type: IndicatorType;
    source?: IndicatorSource;
    metadata?: Record<string, any>;
}

export enum IndicatorType {
    IPv4 = 'ipv4',
    IPv6 = 'ipv6',
    DOMAIN = 'domain',
    HASH = 'hash',
    EMAIL = 'email'
}

export enum IndicatorSource {
    TEXT = 'text',
    OCR = 'ocr'
}

export interface ParsedIndicators {
    title: string;
    items: string[];
    sites?: SearchSite[];
    exclusions?: IndicatorExclusion[];
}

/**
 * Filter a list of indicators based on the provided exclusions.
 * @param items a list of indicators
 * @param exclusions a list of indicator exclusions
 * @returns the list of indicators with exclusions filtered
 */
export function filterExclusions(items: string[], exclusions: IndicatorExclusion[]): string[] {
    return items.filter(item => 
        !exclusions.some(exclusion => 
            typeof exclusion === 'string'
                ? item === exclusion
                : exclusion.test(item)
        )
    );
}