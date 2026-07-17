import { apiFetch, bearerHeaders } from "./http";

export async function sendOtp(phone: string, code: string) {
  if (!process.env.SMS_API_URL) return { accepted: true, mock: true };
  return apiFetch<{ accepted: boolean }>("SMS", `${process.env.SMS_API_URL}/messages`, { method: "POST", headers: bearerHeaders(process.env.SMS_API_KEY), body: JSON.stringify({ to: `+241${phone.replace(/^0/, "")}`, message: `Votre code Moov Assist est ${code}. Il expire dans 5 minutes.` }) });
}
