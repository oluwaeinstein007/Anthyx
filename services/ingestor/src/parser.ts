import * as fs from "fs/promises";
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
  return { text: result.text, sourceType: "pdf", sourceName: filePath.split("/").pop() ?? "document.pdf" };
}

export async function parseMarkdown(filePath: string): Promise<ParsedContent> {
  const text = await fs.readFile(filePath, "utf-8");
  return { text, sourceType: "markdown", sourceName: filePath.split("/").pop() ?? "document.md" };
}

export async function parseUrl(url: string): Promise<ParsedContent> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AnthyxBot/1.0; +https://anthyx.ai/bot)" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`Failed to fetch URL ${url}: ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, aside, .cookie-banner, #cookie").remove();

  const title = $("title").text().trim();
  const metaDescription = $('meta[name="description"]').attr("content") ?? "";
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  return { text: [title, metaDescription, bodyText].filter(Boolean).join("\n\n"), sourceType: "url", sourceName: url };
}

export async function parseSource(source: { type: SourceType; path?: string; url?: string }): Promise<ParsedContent> {
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
