import { apiFetch, bearerHeaders } from "./http";
import { db, hasDatabase } from "./db";
import { audit } from "./audit";

export async function submitKyc(input: { customerId: string; documentType: string; identityFileName: string; identityMimeType?: string; identityStorageKey?: string; addressFileName: string; addressMimeType?: string; addressStorageKey?: string; addressSha256?: string; ocrText?: string; confidence?: number; sha256?: string; extractedData?: Record<string, unknown> }) {
  const reference = `KYC-${Date.now().toString().slice(-8)}`;
  if (hasDatabase()) {
    const user = await db().user.upsert({ where: { phone: input.customerId }, update: {}, create: { phone: input.customerId } });
    const application = await db().kycApplication.create({ data: {
      reference, status: "PENDING_REVIEW", documentType: input.documentType, extractedData: input.extractedData as object | undefined, confidence: input.confidence, userId: user.id,
      documents: { create: [
        { kind: "identity", fileName: input.identityFileName, mimeType: input.identityMimeType || "image/unknown", sha256: input.sha256 || "pending", storageKey: input.identityStorageKey, ocrText: input.ocrText },
        { kind: "address", fileName: input.addressFileName, mimeType: input.addressMimeType || "application/unknown", sha256: input.addressSha256 || "pending", storageKey: input.addressStorageKey },
      ] },
    }});
    await audit("kyc.submit", "kyc_application", "success", { userId: user.id, resourceId: application.id, metadata: { reference } });
  }
  if (!process.env.KYC_API_URL) return { reference, status: "pending_review", submittedAt: new Date().toISOString(), persisted: hasDatabase(), mock: true };
  return apiFetch("KYC", `${process.env.KYC_API_URL}/applications`, { method: "POST", headers: bearerHeaders(process.env.KYC_API_KEY), body: JSON.stringify(input) }, 20000);
}
