import * as fs from "fs/promises";
import * as dns from "dns/promises";
import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";

export type SourceType = "pdf" | "markdown" | "url" | "plaintext";

export interface ParsedContent {
  text: string;
  sourceType: SourceType;
  sourceName: string;
}

export async function parsePdf(filePath: string): Promise<ParsedContent> {
  const buffer = await fs.readFile(filePath);
  const result = await pdfParse(buffer);
  return { text: result.text, sourceType: "pdf", sourceName: filePath.split("/").pop() ?? "document.pdf" };
}

export async function parseMarkdown(filePath: string): Promise<ParsedContent> {
  const text = await fs.readFile(filePath, "utf-8");
  return { text, sourceType: "markdown", sourceName: filePath.split("/").pop() ?? "document.md" };
}

const BOT_UA = "Mozilla/5.0 (compatible; AnthyxBot/1.0; +https://anthyx.ai/bot)";

async function resolve4WithRetry(hostname: string): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const addrs = await dns.resolve4(hostname);
      return addrs[0]!;
    } catch (err) {
      lastErr = err;
      if (i < 2) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

// Alpine musl getaddrinfo is unreliable inside Docker. We resolve the hostname
// via Node's c-ares resolver first, then rewrite the URL to use the IPv4 address
// directly so TLS cert validation still uses the original hostname via Host header.
async function fetchWithFallback(url: string): Promise<Response> {
  const signal = AbortSignal.timeout(20_000);
  const headers = { "User-Agent": BOT_UA };

  try {
    return await fetch(url, { headers, signal });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException })?.cause?.code;
    if (code !== "ETIMEDOUT" && code !== "ECONNREFUSED" && code !== "EAI_AGAIN" && code !== "ENETUNREACH" && code !== "ESERVFAIL") {
      throw err;
    }

    // Resolve hostname via c-ares (bypasses musl getaddrinfo), then fetch by IP
    const parsed = new URL(url);
    const ipv4 = await resolve4WithRetry(parsed.hostname);
    const ipUrl = `${parsed.protocol}//${ipv4}${parsed.pathname}${parsed.search}`;
    return fetch(ipUrl, {
      headers: { ...headers, Host: parsed.hostname },
      signal: AbortSignal.timeout(20_000),
    });
  }
}

export async function parseUrl(url: string): Promise<ParsedContent> {
  const response = await fetchWithFallback(url);

  if (!response.ok) throw new Error(`Failed to fetch URL ${url}: ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, aside, .cookie-banner, #cookie").remove();

  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content") ?? "";
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  return { text: [title, metaDescription, bodyText].filter(Boolean).join("\n\n"), sourceType: "url", sourceName: url };
}

export async function parseSource(source: { type: SourceType; path?: string; url?: string; rawText?: string }): Promise<ParsedContent> {
  switch (source.type) {
    case "pdf":
      if (!source.path) throw new Error("PDF source requires a file path");
      return parsePdf(source.path);
    case "markdown":
      if (!source.path) throw new Error("Markdown source requires a file path");
      return parseMarkdown(source.path);
    case "url":
      if (!source.url) throw new Error("URL source requires a url");
      return parseUrl(source.url);
    case "plaintext":
      if (!source.rawText) throw new Error("Plaintext source requires rawText");
      return { text: source.rawText, sourceType: "plaintext", sourceName: "raw-text" };
    default:
      throw new Error(`Unknown source type: ${(source as { type: string }).type}`);
  }
}
