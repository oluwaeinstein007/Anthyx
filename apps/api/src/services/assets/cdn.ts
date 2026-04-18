/**
 * CDN upload utility.
 * Supports AWS S3 and DigitalOcean Spaces (S3-compatible).
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function getS3Client(): S3Client {
  // DigitalOcean Spaces (S3-compatible)
  if (process.env["DO_SPACES_KEY"]) {
    return new S3Client({
      region: "us-east-1",
      endpoint: `https://${process.env["DO_SPACES_ENDPOINT"]}`,
      credentials: {
        accessKeyId: process.env["DO_SPACES_KEY"]!,
        secretAccessKey: process.env["DO_SPACES_SECRET"]!,
      },
    });
  }

  // AWS S3
  return new S3Client({
    region: process.env["AWS_REGION"] ?? "us-east-1",
    credentials: {
      accessKeyId: process.env["AWS_ACCESS_KEY_ID"]!,
      secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"]!,
    },
  });
}

export async function uploadToCDN(sourceUrl: string, filename?: string): Promise<string> {
  const bucket =
    process.env["DO_SPACES_BUCKET"] ?? process.env["AWS_S3_BUCKET"] ?? "anthyx-assets";

  const key = filename ?? `assets/${Date.now()}-${crypto.randomUUID()}.png`;

  // Fetch the image from the source URL
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  const s3 = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      ACL: "public-read",
    }),
  );

  if (process.env["DO_SPACES_ENDPOINT"]) {
    return `https://${bucket}.${process.env["DO_SPACES_ENDPOINT"]}/${key}`;
  }

  return `https://${bucket}.s3.${process.env["AWS_REGION"] ?? "us-east-1"}.amazonaws.com/${key}`;
}
