export interface IngestBrandPayload {
  brandId: string;
  organizationId: string;
  sourceType: "pdf" | "url" | "markdown";
  filePath?: string;
  url?: string;
  sourceName?: string;
}
