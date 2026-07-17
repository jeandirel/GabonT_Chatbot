import { NextRequest, NextResponse } from "next/server";
import { submitKyc } from "../../../lib/server/kyc";
import { authenticatedUser, authenticationStatus } from "../../../lib/server/auth";
import { db, hasDatabase } from "../../../lib/server/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.documentType || !body.identityFileName || !body.addressFileName || !body.sha256) return NextResponse.json({ error: "Dossier KYC incomplet ou OCR non exécuté" }, { status: 400 });
    const user = await authenticatedUser(request, body.customerId || "demo-user");
    let identityStorageKey: string | undefined; let addressStorageKey: string | undefined;
    if (hasDatabase()) {
      const uploads = await db().pendingUpload.findMany({ where: { id: { in: [body.identityUploadId, body.addressUploadId].filter(Boolean) }, userId: user.id, consumedAt: null } });
      const identity = uploads.find(item => item.kind === "identity" && item.id === body.identityUploadId);
      const address = uploads.find(item => item.kind === "address" && item.id === body.addressUploadId);
      if (!identity || !address || identity.sha256 !== body.sha256 || address.sha256 !== body.addressSha256) return NextResponse.json({ error: "Les documents ne correspondent pas à la session KYC" }, { status: 400 });
      identityStorageKey = identity.storageKey || undefined; addressStorageKey = address.storageKey || undefined;
    }
    const result = await submitKyc({ customerId: user.phone, documentType: body.documentType, identityFileName: body.identityFileName, identityMimeType: body.identityMimeType, identityStorageKey, addressFileName: body.addressFileName, addressMimeType: body.addressMimeType, addressStorageKey, addressSha256: body.addressSha256, ocrText: body.ocrText, confidence: body.confidence, sha256: body.sha256, extractedData: body.extractedData });
    if (hasDatabase()) await db().pendingUpload.updateMany({ where: { id: { in: [body.identityUploadId, body.addressUploadId] }, userId: user.id }, data: { consumedAt: new Date() } });
    return NextResponse.json(result, { status: 202 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Soumission impossible" }, { status: authenticationStatus(error) }); }
}
