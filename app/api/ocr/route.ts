import { NextRequest, NextResponse } from "next/server";
import { recognizeIdentityDocument } from "../../../lib/server/ocr";
import { audit } from "../../../lib/server/audit";
import { clientKey, rateLimit } from "../../../lib/server/rate-limit";
import { storePrivateFile } from "../../../lib/server/storage";
import { authenticatedUser, authenticationStatus } from "../../../lib/server/auth";
import { db, hasDatabase } from "../../../lib/server/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`ocr:${clientKey(request)}`, 5, 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Limite d’analyses atteinte." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    const user = await authenticatedUser(request, "demo-user");
    const data = await request.formData();
    const file = data.get("document");
    if (!(file instanceof File)) return NextResponse.json({ error: "Document manquant" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Le document dépasse 10 Mo" }, { status: 413 });
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "Format OCR accepté : JPG, PNG ou WebP" }, { status: 415 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const [result, stored] = await Promise.all([
      recognizeIdentityDocument(bytes),
      storePrivateFile({ bytes, fileName: file.name, mimeType: file.type, namespace: "identity" }),
    ]);
    const upload = hasDatabase() ? await db().pendingUpload.create({ data: { userId: user.id, kind: "identity", fileName: file.name, mimeType: file.type, sha256: result.sha256, storageKey: stored.storageKey } }) : undefined;
    await audit("ocr.recognize", "kyc_document", "success", { userId: user.id, metadata: { fileName: file.name, mimeType: file.type, sha256: result.sha256, confidence: result.confidence } });
    return NextResponse.json({ ...result, uploadId: upload?.id, fileName: file.name, mimeType: file.type, persisted: stored.persisted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await audit("ocr.recognize", "kyc_document", "failure", { metadata: { error: error instanceof Error ? error.message : "unknown" } });
    return NextResponse.json({ error: error instanceof Error ? error.message : "L’analyse OCR a échoué. Reprenez la photo dans un endroit éclairé." }, { status: authenticationStatus(error) });
  }
}
