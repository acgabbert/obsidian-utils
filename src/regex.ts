// regex for possibly defanged values
const ipv4Octet = "(?:25[0-5]|" +  // 250-255
                  "(2[0-4]|1{0,1}[0-9]){0,1}[0-9])";  // 0-249
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
    "g"
);
export { IP_REGEX as IPv4_REGEX };
export const IPv6_REGEX = new RegExp(
    "(" +
    "(?:::|[0-9a-f]{1,4}::?)(?:[0-9a-f]{1,4}::?){0,6}(?:[0-9a-f]{1,4}|::?)" +
    ")",
    "gi"
)
export const LOCAL_IP_REGEX = /^(127\.)|(10\.)|(172\.1[6-9]\.)|(172\.2[0-9]\.)|(172\.3[0-1]\.)|(192\.168\.)/g;
export const MACRO_REGEX = /({{([^}]+)}})/g;
export const DOMAIN_REGEX = /((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(\.|\[\.\]))+[a-z][a-z0-9-]{0,61}[a-z](?=\.?)\b)/gi;
export const HASH_REGEX = /(?:^|[^a-f0-9]+)([a-f0-9]{64}|[a-f0-9]{40}|[a-f0-9]{32})(?:$|[^a-f0-9]+)/gi;
export const FILE_REGEX = /(?:^|\s|")((\w:\\|[\\/])[^\\/]+[\\/]([^\\/\n"|]+[\\/]?)+(\.\w+)?)/gi;

function possiblyDefangedVal(val: string): string {
    return `\\[?${val}\\]?`;
}