export interface IngestBrandPayload {
  brandId: string;
  organizationId: string;
  sourceType: "pdf" | "url" | "markdown" | "plaintext";
  filePath?: string;
  url?: string;
  rawText?: string;
  sourceName?: string;
}
