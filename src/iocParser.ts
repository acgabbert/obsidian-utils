import { SearchSite } from "./searchSites";

export type IndicatorExclusion = string | RegExp;

export interface Indicator {
    value: string;
    type: IndicatorType;
    source?: IndicatorSource;
    metadata?: Record<string, any>;
}

export type GroupedIndicators = {
    [key in IndicatorSource]: {
        [key in IndicatorType]: Indicator[]
    };
};

export enum IndicatorType {
    IPv4 = 'ipv4',
    PRIVATE_IPv4 = 'private_ipv4',
    IPv6 = 'ipv6',
    PRIVATE_IPv6 = 'private_ipv6',
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

export function groupIndicators(indicators: Indicator[]): GroupedIndicators {
    const grouped: GroupedIndicators = {
        [IndicatorSource.TEXT]: {
            [IndicatorType.IPv4]: [],
            [IndicatorType.PRIVATE_IPv4]: [],
            [IndicatorType.IPv6]: [],
            [IndicatorType.PRIVATE_IPv6]: [],
            [IndicatorType.DOMAIN]: [],
            [IndicatorType.HASH]: [],
            [IndicatorType.EMAIL]: []
        },
        [IndicatorSource.OCR]: {
            [IndicatorType.IPv4]: [],
            [IndicatorType.PRIVATE_IPv4]: [],
            [IndicatorType.IPv6]: [],
            [IndicatorType.PRIVATE_IPv6]: [],
            [IndicatorType.DOMAIN]: [],
            [IndicatorType.HASH]: [],
            [IndicatorType.EMAIL]: []
        }
    };

    const seenIndicators = new Set<string>();
    
    for (const indicator of indicators) {
        // Default to text if not specified
        const source = indicator.source || IndicatorSource.TEXT;
        const uniqueKey = `${source}:${indicator.value}`;
        
        // If we've already seen this indicator in this source, skip it
        if (seenIndicators.has(uniqueKey)) {
            continue;
        }
        
        // Mark the indicator as seen and add to the appropriate group
        seenIndicators.add(uniqueKey);
        grouped[source][indicator.type].push(indicator);
    }

    return grouped;
}