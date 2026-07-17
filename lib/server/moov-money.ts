import { apiFetch, bearerHeaders } from "./http";

export type TransactionRequest = { recipient: string; amount: number; idempotencyKey: string; channel: "chat"|"app"; confirmationToken: string };

const mock = {
  balance: { available: 1248500, currency: "XAF", updatedAt: new Date().toISOString() },
  transactions: [
    { id: "TX-2026-7842", label: "Supermarché Mbolo", amount: -28500, status: "completed", createdAt: "2026-07-17T11:42:00Z" },
    { id: "TX-2026-7794", label: "Alain N.", amount: 75000, status: "completed", createdAt: "2026-07-16T18:10:00Z" },
  ]
};

function configured() { return Boolean(process.env.MOOV_MONEY_API_URL && process.env.MOOV_MONEY_API_KEY); }
function endpoint(path: string) { return `${process.env.MOOV_MONEY_API_URL}${path}`; }
function headers() { return bearerHeaders(process.env.MOOV_MONEY_API_KEY); }

export async function getBalance(customerId: string) {
  if (!configured()) return { ...mock.balance, mock: true };
  return apiFetch("Moov Money", endpoint(`/v1/customers/${encodeURIComponent(customerId)}/balance`), { headers: headers() });
}

export async function getTransactions(customerId: string) {
  if (!configured()) return { items: mock.transactions, mock: true };
  return apiFetch("Moov Money", endpoint(`/v1/customers/${encodeURIComponent(customerId)}/transactions`), { headers: headers() });
}

export async function initiateTransfer(customerId: string, input: TransactionRequest) {
  if (!input.confirmationToken) throw new Error("Une confirmation forte est obligatoire.");
  if (!configured()) return { id: `MOOV-${Date.now()}`, status: "completed", amount: input.amount, currency: "XAF", mock: true };
  return apiFetch("Moov Money", endpoint("/v1/transfers"), { method: "POST", headers: { ...headers(), "Idempotency-Key": input.idempotencyKey }, body: JSON.stringify({ customerId, ...input }) });
}

export async function payBill(customerId: string, input: { provider: string; reference: string; amount: number; confirmationToken: string; idempotencyKey: string }) {
  if (!input.confirmationToken) throw new Error("Une confirmation forte est obligatoire.");
  if (!configured()) return { id: `BILL-${Date.now()}`, status: "completed", ...input, confirmationToken: undefined, mock: true };
  return apiFetch("Moov Money", endpoint("/v1/bills/payments"), { method: "POST", headers: { ...headers(), "Idempotency-Key": input.idempotencyKey }, body: JSON.stringify({ customerId, ...input }) });
}
