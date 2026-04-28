import * as fs from "fs/promises";
import * as dns from "dns/promises";
import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";

export type SourceType = "pdf" | "markdown" | "url";

export interface ParsedContent {
  text: string;
  sourceType: SourceType;
  sourceName: string;
}

export async function parsePdf(filePath: string): Promise<ParsedContent> {
  const buffer = await fs.readFile(filePath);
  const result = await pdfParse(buffer);
  return {
    text: result.text,
    sourceType: "pdf",
    sourceName: filePath.split("/").pop() ?? "document.pdf",
  };
}

export async function parseMarkdown(filePath: string): Promise<ParsedContent> {
  const text = await fs.readFile(filePath, "utf-8");
  return {
    text,
    sourceType: "markdown",
    sourceName: filePath.split("/").pop() ?? "document.md",
  };
}

const BOT_CHALLENGE_PATTERNS = [
  /checking your browser/i,
  /just a moment/i,
  /jschallengeurl/i,
  /hcdn-cgi\/jschallenge/i,
  /enable javascript/i,
  /please wait.*seconds/i,
  /_cf_chl_/i,
  /cf-challenge/i,
  /ddos-guard/i,
];

function isBotChallengePage(html: string): boolean {
  return BOT_CHALLENGE_PATTERNS.some((re) => re.test(html));
}

function mapFetchError(err: unknown, url: string): Error {
  if (!(err instanceof Error)) return new Error(`Failed to fetch ${url}`);
  const cause = (err as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException & { errors?: NodeJS.ErrnoException[] } }).cause;
  const codes = [cause?.code, ...(cause?.errors?.map((e) => e.code) ?? [])].filter(Boolean);
  if (codes.some((c) => c === "ETIMEDOUT" || c === "ECONNREFUSED")) {
    return new Error(`Could not connect to ${url} — the site may be blocking automated access or is unreachable. Try pasting the content as text instead.`);
  }
  if (codes.some((c) => c === "ENOTFOUND" || c === "EAI_AGAIN")) {
    return new Error(`Could not resolve ${new URL(url).hostname} — check the URL and try again.`);
  }
  return new Error(err.message ?? `Failed to fetch ${url}`);
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

// Alpine musl getaddrinfo is unreliable inside Docker. fetch() only throws on
// network-level errors (not HTTP errors), so any exception means DNS/connect
// failed — always retry via Node's c-ares resolver and fetch by IPv4 directly,
// passing the original hostname in the Host header so TLS still validates.
async function fetchWithFallback(url: string): Promise<Response> {
  try {
    return await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
  } catch {
    const parsed = new URL(url);
    const [ipv4] = await dns.resolve4(parsed.hostname);
    const ipUrl = `${parsed.protocol}//${ipv4}${parsed.pathname}${parsed.search}`;
    return fetch(ipUrl, {
      headers: { ...FETCH_HEADERS, Host: parsed.hostname },
      signal: AbortSignal.timeout(20_000),
    });
  }
}

export async function parseUrl(rawUrl: string): Promise<ParsedContent> {
  // Normalize URL: prepend https:// if no scheme is present
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  let response: Response;
  try {
    response = await fetchWithFallback(url);
  } catch (err) {
    throw mapFetchError(err, url);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (isBotChallengePage(body)) {
      throw new Error(`${new URL(url).hostname} uses bot protection that requires a real browser. Copy the page content and use the Text input instead.`);
    }
    throw new Error(`${new URL(url).hostname} returned ${response.status}. The site may require login or block automated access.`);
  }

  const html = await response.text();

  if (isBotChallengePage(html)) {
    throw new Error(`${new URL(url).hostname} uses bot protection that requires a real browser. Copy the page content and use the Text input instead.`);
  }

  const $ = cheerio.load(html);

  // Remove script, style, nav, footer — keep meaningful content
  $("script, style, nav, footer, header, aside, .cookie-banner, #cookie").remove();

  // Extract title + main content
  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content") ?? "";
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  const text = [title, metaDescription, bodyText].filter(Boolean).join("\n\n");

  if (!text.trim()) {
    throw new Error(`No readable content found at ${url}. The page may be JavaScript-rendered or empty.`);
  }

  return {
    text,
    sourceType: "url",
    sourceName: url,
  };
}

export async function parseSource(
  source: { type: SourceType; path?: string; url?: string },
): Promise<ParsedContent> {
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
    default:
      throw new Error(`Unknown source type: ${(source as { type: string }).type}`);
  }
}
