// regex for possibly defanged values
const ipv4Octet = "(?:25[0-5]|" +  // 250-255
                  "(2[0-4]|1{0,1}[0-9]){0,1}[0-9])";  // 0-249
const ipv6Octet = "[0-9a-fA-F]{1,4}"
export const IP_REGEX = new RegExp(
    // match a possibly url-encoded character preceding, or
    // a word boundary
    String.raw`(?:%[0-9a-fA-F]{2})?(?=\b|^)(` +
    `(?:${ipv4Octet + possiblyDefangedVal(String.raw`\.`)}){3}` +
    ipv4Octet +
    ")",
    "g"  // flags
);
export { IP_REGEX as IPv4_REGEX };
export const IPv6_REGEX = new RegExp(
    `((?:${ipv6Octet}${possiblyDefangedVal(":")}){7}${ipv6Octet}|` +  // 8 segments
    `(?:(?:${ipv6Octet}${possiblyDefangedVal(":")})*${ipv6Octet})?${possiblyDefangedVal("::")}` +  // zero or more segments followed by ::
    `(?:(?:${ipv6Octet}${possiblyDefangedVal(":")})*${ipv6Octet})?)`,  // zero or more segments
    "gi"  // flags
)
export const LOCAL_IP_REGEX = /^((127\.)|(10\.)|(172\.1[6-9]\.)|(172\.2[0-9]\.)|(172\.3[0-1]\.)|(192\.168\.))/g;
export const MACRO_REGEX = /({{([^}]+)}})/g;
const DOMAIN_REGEX_OLD = /(?:%[0-9a-f]{2})?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(\.|\[\.\]))+[a-z][a-z0-9-]{0,61}[a-z](?=\.?)\b)/gi;
export const DOMAIN_REGEX = new RegExp(
    String.raw`(?:%[0-9a-f]{2})?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?` +
    possiblyDefangedVal(String.raw`\.`) + `)+` + 
    String.raw`[a-z][a-z0-9-]{0,61}[a-z](?=\.?)\b)`,
    "gi"  // flags
);
const hash_start = "(?:%[0-9a-f]{2})?(?<=^|[^a-f0-9]+)";  // beginning of string or non-hex character
const hash_end = "(?=$|[^a-f0-9]+)";  // end of string or non-hex character
export const HASH_REGEX = new RegExp(
    hash_start +
    "([a-f0-9]{64}|[a-f0-9]{40}|[a-f0-9]{32})" +  // standard hash length (SHA256, MD5, SHA1)
    hash_end,
    "gi"  // flags
);
export const SHA256_REGEX = new RegExp(
    hash_start +
    "([a-f0-9]{64})" +  // SHA256 hash length
    hash_end,
    "gi"  // flags
);
export const MD5_REGEX = new RegExp(
    hash_start +
    "([a-f0-9]{32})" +  // SHA256 hash length
    hash_end,
    "gi"  // flags
);
export const SHA1_REGEX = new RegExp(
    hash_start +
    "([a-f0-9]{40})" +  // SHA256 hash length
    hash_end,
    "gi"  // flags
);
export const FILE_REGEX = new RegExp(
    String.raw`(?:%[0-9a-f]{2})?(?<=^|\s|")` +  // beginning of string, space, or open quote
    "(" +
    String.raw`(?:\w:\\|[\\/])` +  // drive letter or leading slash
    String.raw`(?:[^\\/:][\\/]?)+` +  // 
    String.raw`[^\\/\n"|]+\.\w+` +  // filename with extension
    ")",
    "gi"
)

function possiblyDefangedVal(val: string): string {
    return String.raw`[\[\(\\]?${val}[\]\)]?`;
}