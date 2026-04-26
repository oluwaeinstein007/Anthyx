/**
 * CDN upload utility.
 * Provider priority: Cloudinary → DigitalOcean Spaces → AWS S3
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function isCloudinaryConfigured() {
  return !!(
    process.env["CLOUDINARY_CLOUD_NAME"] &&
    process.env["CLOUDINARY_API_KEY"] &&
    process.env["CLOUDINARY_API_SECRET"]
  );
}

function isDoSpacesConfigured() {
  return !!process.env["DO_SPACES_KEY"];
}

async function uploadToCloudinary(buffer: Buffer, contentType: string, filename?: string): Promise<string> {
  const { v2: cloudinary } = await import("cloudinary");

  cloudinary.config({
    cloud_name: process.env["CLOUDINARY_CLOUD_NAME"],
    api_key: process.env["CLOUDINARY_API_KEY"],
    api_secret: process.env["CLOUDINARY_API_SECRET"],
  });

  const publicId = filename?.replace(/\.[^.]+$/, "") ?? `assets/${Date.now()}-${crypto.randomUUID()}`;
  const resourceType = contentType.startsWith("video/") ? "video" : "image";

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: resourceType },
      (err, res) => (err ? reject(err) : resolve(res as { secure_url: string })),
    ).end(buffer);
  });

  return result.secure_url;
}

function getS3Client(): S3Client {
  if (isDoSpacesConfigured()) {
    return new S3Client({
      region: "us-east-1",
      endpoint: `https://${process.env["DO_SPACES_ENDPOINT"]}`,
      credentials: {
        accessKeyId: process.env["DO_SPACES_KEY"]!,
        secretAccessKey: process.env["DO_SPACES_SECRET"]!,
      },
    });
  }

  return new S3Client({
    region: process.env["AWS_REGION"] ?? "us-east-1",
    credentials: {
      accessKeyId: process.env["AWS_ACCESS_KEY_ID"]!,
      secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"]!,
    },
  });
}

export async function uploadToCDN(sourceUrl: string, filename?: string): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadBufferToCDN(buffer, "image/png", filename);
}

export async function uploadBufferToCDN(
  buffer: Buffer,
  contentType = "image/jpeg",
  filename?: string,
): Promise<string> {
  if (isCloudinaryConfigured()) {
    return uploadToCloudinary(buffer, contentType, filename);
  }

  const MIME_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
  };
  const ext = MIME_EXT[contentType] ?? "bin";
  const key = filename ?? `assets/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const isDoSpaces = isDoSpacesConfigured();
  const bucket = isDoSpaces
    ? (process.env["DO_SPACES_BUCKET"] ?? "anthyx-assets")
    : (process.env["AWS_S3_BUCKET"] ?? "anthyx-assets");

  const s3 = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  if (isDoSpaces && process.env["DO_SPACES_ENDPOINT"]) {
    return `https://${bucket}.${process.env["DO_SPACES_ENDPOINT"]}/${key}`;
  }

  return `https://${bucket}.s3.${process.env["AWS_REGION"] ?? "us-east-1"}.amazonaws.com/${key}`;
}
