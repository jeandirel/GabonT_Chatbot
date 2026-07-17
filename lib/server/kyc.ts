import { apiFetch, bearerHeaders } from "./http";

export async function submitKyc(input: { customerId: string; documentType: string; identityFileName: string; addressFileName: string }) {
  if (!process.env.KYC_API_URL) return { reference: `KYC-${Date.now().toString().slice(-8)}`, status: "pending_review", submittedAt: new Date().toISOString(), mock: true };
  return apiFetch("KYC", `${process.env.KYC_API_URL}/applications`, { method: "POST", headers: bearerHeaders(process.env.KYC_API_KEY), body: JSON.stringify(input) }, 20000);
}
