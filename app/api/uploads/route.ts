import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser, authenticationStatus } from "../../../lib/server/auth";
import { audit } from "../../../lib/server/audit";
import { clientKey, rateLimit } from "../../../lib/server/rate-limit";
import { storePrivateFile } from "../../../lib/server/storage";
import { db, hasDatabase } from "../../../lib/server/db";

export const runtime = "nodejs";

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`upload:${clientKey(request)}`, 10, 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Limite d’envois atteinte." }, { status: 429 });
    const user = await authenticatedUser(request, "demo-user");
    const data = await request.formData();
    const file = data.get("document");
    if (!(file instanceof File)) return NextResponse.json({ error: "Document manquant" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Le document dépasse 10 Mo" }, { status: 413 });
    if (!allowed.has(file.type)) return NextResponse.json({ error: "Format non accepté" }, { status: 415 });
    const stored = await storePrivateFile({ bytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name, mimeType: file.type, namespace: "address" });
    const upload = hasDatabase() ? await db().pendingUpload.create({ data: { userId: user.id, kind: "address", fileName: file.name, mimeType: file.type, sha256: stored.sha256, storageKey: stored.storageKey } }) : undefined;
    await audit("document.upload", "kyc_document", "success", { userId: user.id, metadata: { fileName: file.name, mimeType: file.type, sha256: stored.sha256 } });
    return NextResponse.json({ uploadId: upload?.id, sha256: stored.sha256, persisted: stored.persisted, fileName: file.name, mimeType: file.type }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi impossible" }, { status: authenticationStatus(error) });
  }
}
