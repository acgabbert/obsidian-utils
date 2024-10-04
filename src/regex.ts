// regex for possibly defanged values
const ipv4Octet = "(?:25[0-5]|" +  // 250-255
                  "(2[0-4]|1{0,1}[0-9]){0,1}[0-9])";  // 0-249
const ipv6Octet = "[0-9a-fA-F]{1,4}"
export const IP_REGEX = new RegExp(
    "(?:[^\\d]|^)(" +
    ipv4Octet +
    possiblyDefangedVal("\\.") +
    ipv4Octet +
    possiblyDefangedVal("\\.") +
    ipv4Octet +
    possiblyDefangedVal("\\.") +
    ipv4Octet +
    ")",
    "g"  // flags
);
export { IP_REGEX as IPv4_REGEX };
export const IPv6_REGEX = new RegExp(
    "(" +
    `(${ipv6Octet}:){7,7}${ipv6Octet}|` +
    `(${ipv6Octet}:){1,7}:|` +
    `(${ipv6Octet}:){1,6}:${ipv6Octet}|` +
    `(${ipv6Octet}:){1,5}(:${ipv6Octet}){1,2}|` +
    `(${ipv6Octet}:){1,4}(:${ipv6Octet}){1,3}|` +
    `(${ipv6Octet}:){1,3}(:${ipv6Octet}){1,4}|` +
    `(${ipv6Octet}:){1,2}(:${ipv6Octet}){1,5}|` +
    `${ipv6Octet}:((:${ipv6Octet}){1,6})|` +
    `:((:${ipv6Octet}){1,7}|:)|` +
    "fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|" +
    "::(ffff(:0{1,4}){0,1}:){0,1}" +
    ")",
    "gi"  // flags
);
export const LOCAL_IP_REGEX = /^((127\.)|(10\.)|(172\.1[6-9]\.)|(172\.2[0-9]\.)|(172\.3[0-1]\.)|(192\.168\.))/g;
export const MACRO_REGEX = /({{([^}]+)}})/g;
export const DOMAIN_REGEX = /((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(\.|\[\.\]))+[a-z][a-z0-9-]{0,61}[a-z](?=\.?)\b)/gi;
export const HASH_REGEX = new RegExp(
    "(?<=^|[^a-f0-9]+)" +  // beginning of string or non-hex character
    "([a-f0-9]{64}|[a-f0-9]{40}|[a-f0-9]{32})" +  // standard hash length (SHA256, MD5, SHA1)
    "(?=$|[^a-f0-9]+)",  // end of string or non-hex character
    "gi"  // flags
);
export const FILE_REGEX = new RegExp(
    "(?<=^|\\s|\")" +  // beginning of string, space, or open quote
    "(" +
    "(?:\\w:\\\\|[\\\\/])" +  // drive letter or leading slash
    "(?:[^\\\\/:][\\\\/]?)+" +  // 
    "[^\\\\/\\n\"|]+\\.\\w+" +  // filename with extension
    ")",
    "gi"
)

function possiblyDefangedVal(val: string): string {
    return `\\[?${val}\\]?`;
}