import { apiFetch, bearerHeaders } from "./http";
import { db, hasDatabase } from "./db";
import { audit } from "./audit";

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
  const result = configured() ? await apiFetch<{ id: string; status: string }>("Moov Money", endpoint("/v1/transfers"), { method: "POST", headers: { ...headers(), "Idempotency-Key": input.idempotencyKey }, body: JSON.stringify({ customerId, ...input }) }) : { id: `MOOV-${Date.now()}`, status: "completed" };
  if (hasDatabase()) {
    const user = await db().user.upsert({ where: { phone: customerId }, update: {}, create: { phone: customerId } });
    const transaction = await db().transaction.upsert({ where: { idempotencyKey: input.idempotencyKey }, update: { externalId: result.id, status: result.status === "completed" ? "COMPLETED" : "PROCESSING" }, create: { reference: result.id, externalId: result.id, type: "TRANSFER", status: result.status === "completed" ? "COMPLETED" : "PROCESSING", amount: input.amount, recipient: input.recipient, idempotencyKey: input.idempotencyKey, userId: user.id } });
    await audit("transaction.transfer", "transaction", result.status, { userId: user.id, resourceId: transaction.id, metadata: { reference: result.id, amount: input.amount, recipient: input.recipient } });
  }
  return { ...result, amount: input.amount, currency: "XAF", persisted: hasDatabase(), mock: !configured() };
}

export async function payBill(customerId: string, input: { provider: string; reference: string; amount: number; confirmationToken: string; idempotencyKey: string }) {
  if (!input.confirmationToken) throw new Error("Une confirmation forte est obligatoire.");
  const result = configured() ? await apiFetch<{ id: string; status: string }>("Moov Money", endpoint("/v1/bills/payments"), { method: "POST", headers: { ...headers(), "Idempotency-Key": input.idempotencyKey }, body: JSON.stringify({ customerId, ...input }) }) : { id: `BILL-${Date.now()}`, status: "completed" };
  if (hasDatabase()) {
    const user = await db().user.upsert({ where: { phone: customerId }, update: {}, create: { phone: customerId } });
    const transaction = await db().transaction.upsert({ where: { idempotencyKey: input.idempotencyKey }, update: { externalId: result.id, status: result.status === "completed" ? "COMPLETED" : "PROCESSING" }, create: { reference: result.id, externalId: result.id, type: "BILL_PAYMENT", status: result.status === "completed" ? "COMPLETED" : "PROCESSING", amount: input.amount, provider: input.provider, idempotencyKey: input.idempotencyKey, userId: user.id } });
    await audit("transaction.bill", "transaction", result.status, { userId: user.id, resourceId: transaction.id, metadata: { reference: result.id, amount: input.amount, provider: input.provider } });
  }
  return { ...result, provider: input.provider, reference: input.reference, amount: input.amount, currency: "XAF", persisted: hasDatabase(), mock: !configured() };
}

export async function purchaseAirtime(customerId: string, input: { recipient: string; amount: number; confirmationToken: string; idempotencyKey: string }) {
  if (!input.confirmationToken) throw new Error("Une confirmation forte est obligatoire.");
  const result = configured() ? await apiFetch<{ id: string; status: string }>("Moov Money", endpoint("/v1/airtime/purchases"), {
    method: "POST",
    headers: { ...headers(), "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({ customerId, recipient: input.recipient, amount: input.amount }),
  }) : { id: `AIR-${Date.now()}`, status: "completed" };
  if (hasDatabase()) {
    const user = await db().user.upsert({ where: { phone: customerId }, update: {}, create: { phone: customerId } });
    const transaction = await db().transaction.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: { externalId: result.id, status: result.status === "completed" ? "COMPLETED" : "PROCESSING" },
      create: { reference: result.id, externalId: result.id, type: "AIRTIME", status: result.status === "completed" ? "COMPLETED" : "PROCESSING", amount: input.amount, recipient: input.recipient, idempotencyKey: input.idempotencyKey, userId: user.id },
    });
    await audit("transaction.airtime", "transaction", result.status, { userId: user.id, resourceId: transaction.id, metadata: { reference: result.id, amount: input.amount, recipient: input.recipient } });
  }
  return { ...result, recipient: input.recipient, amount: input.amount, currency: "XAF", persisted: hasDatabase(), mock: !configured() };
}
