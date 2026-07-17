import { apiFetch, bearerHeaders } from "./http";

export async function getCustomerProfile(customerId: string) {
  if (!process.env.CRM_API_URL) return { id: customerId, segment: "premium", preferredLanguage: "fr", marketingConsent: false, mock: true };
  return apiFetch("CRM", `${process.env.CRM_API_URL}/customers/${encodeURIComponent(customerId)}`, { headers: bearerHeaders(process.env.CRM_API_KEY) });
}

export async function getPersonalizedOffers(customerId: string) {
  if (!process.env.CRM_API_URL) return { items: [
    { id: "airtime-20", label: "Bonus airtime", title: "20 % de crédit offert", text: "Sur votre prochaine recharge de 5 000 FCFA ou plus.", color: "green" },
    { id: "savings-school", label: "Épargne", title: "Objectif rentrée scolaire", text: "Mettez automatiquement 10 000 FCFA de côté chaque semaine.", color: "gold" },
    { id: "canal-free", label: "Canal+", title: "Paiement sans frais", text: "Réglez votre abonnement depuis Moov Assist cette semaine.", color: "blue" },
  ], mock: true };
  return apiFetch("CRM", `${process.env.CRM_API_URL}/customers/${encodeURIComponent(customerId)}/offers`, { headers: bearerHeaders(process.env.CRM_API_KEY) });
}
