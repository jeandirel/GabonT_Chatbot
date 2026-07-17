import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";

function configured() {
  return Boolean(process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

function client() {
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

function extension(fileName: string) {
  const value = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return value ? `.${value.slice(0, 8)}` : "";
}

export async function storePrivateFile(input: { bytes: Uint8Array; fileName: string; mimeType: string; namespace: "identity"|"address"|"support" }) {
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  if (!configured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Le stockage privé S3 n’est pas configuré.");
    return { storageKey: null, sha256, persisted: false, mock: true };
  }
  const storageKey = `kyc/${input.namespace}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension(input.fileName)}`;
  await client().send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: storageKey,
    Body: input.bytes,
    ContentType: input.mimeType,
    ServerSideEncryption: "AES256",
    Metadata: { sha256, originalname: Buffer.from(input.fileName).toString("base64url").slice(0, 512) },
  }));
  return { storageKey, sha256, persisted: true, mock: false };
}
