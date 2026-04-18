import { HttpsProxyAgent } from "https-proxy-agent";

const BRIGHT_DATA_ENDPOINTS = [
  process.env["BRIGHT_DATA_PROXY_1"],
  process.env["BRIGHT_DATA_PROXY_2"],
  process.env["BRIGHT_DATA_PROXY_3"],
].filter(Boolean) as string[];

function hashOrg(orgId: string): number {
  return orgId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function getProxyForOrg(organizationId: string): string | null {
  if (BRIGHT_DATA_ENDPOINTS.length === 0) return null;
  const index = hashOrg(organizationId) % BRIGHT_DATA_ENDPOINTS.length;
  return BRIGHT_DATA_ENDPOINTS[index] ?? null;
}

export function buildProxiedAgent(organizationId: string): HttpsProxyAgent<string> | undefined {
  const proxyUrl = getProxyForOrg(organizationId);
  if (!proxyUrl) return undefined;
  return new HttpsProxyAgent(proxyUrl);
}

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0]!;
}
