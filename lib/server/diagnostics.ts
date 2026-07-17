import { apiFetch, bearerHeaders } from "./http";
import { audit } from "./audit";

export type DiagnosticKind = "PIN_LOCKED"|"SIM_ISSUE"|"TRANSFER_PENDING"|"BALANCE_MISMATCH";

const fallback: Record<DiagnosticKind, { status: string; checks: { label: string; status: string }[]; recommendation: string; requiresAgent: boolean }> = {
  PIN_LOCKED: { status: "action_required", checks: [{ label: "Ligne mobile reconnue", status: "passed" }, { label: "Compte Moov Money actif", status: "passed" }, { label: "Compteur de tentatives PIN", status: "blocked" }], recommendation: "Une réinitialisation sécurisée du PIN doit être validée par le service client.", requiresAgent: true },
  SIM_ISSUE: { status: "action_required", checks: [{ label: "État de la ligne", status: "passed" }, { label: "Association SIM / portefeuille", status: "review" }], recommendation: "Vérifiez la SIM active dans le téléphone. Si le problème persiste, un conseiller vérifiera l’association de la ligne.", requiresAgent: true },
  TRANSFER_PENDING: { status: "monitoring", checks: [{ label: "Transaction localisée", status: "passed" }, { label: "Confirmation opérateur", status: "pending" }], recommendation: "La transaction est toujours en traitement. Aucun second transfert ne doit être lancé avant sa résolution.", requiresAgent: false },
  BALANCE_MISMATCH: { status: "review", checks: [{ label: "Solde temps réel interrogé", status: "passed" }, { label: "Rapprochement des opérations", status: "review" }], recommendation: "Un rapprochement est nécessaire si le solde ne se met pas à jour après quelques minutes.", requiresAgent: true },
};

export async function runDiagnostic(customerId: string, kind: DiagnosticKind, reference?: string) {
  const result = process.env.MOOV_MONEY_API_URL && process.env.MOOV_MONEY_API_KEY
    ? await apiFetch<Record<string, unknown>>("Moov Money", `${process.env.MOOV_MONEY_API_URL}/v1/customers/${encodeURIComponent(customerId)}/diagnostics`, { method: "POST", headers: bearerHeaders(process.env.MOOV_MONEY_API_KEY), body: JSON.stringify({ kind, reference }) })
    : { ...fallback[kind], mock: true };
  await audit("diagnostic.run", "customer_account", "success", { metadata: { customerId, kind, reference } });
  return { kind, checkedAt: new Date().toISOString(), ...result };
}
