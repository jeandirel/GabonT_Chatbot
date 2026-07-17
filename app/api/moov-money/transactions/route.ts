import { NextRequest, NextResponse } from "next/server";
import { getTransactions, initiateTransfer } from "../../../../lib/server/moov-money";

export async function GET(request: NextRequest) {
  return NextResponse.json(await getTransactions(request.nextUrl.searchParams.get("customerId") || "demo-user"));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.recipient || !Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) return NextResponse.json({ error: "Bénéficiaire ou montant invalide" }, { status: 400 });
  const result = await initiateTransfer(body.customerId || "demo-user", { recipient: body.recipient, amount: Number(body.amount), channel: "chat", confirmationToken: body.confirmationToken || "demo-confirmation", idempotencyKey: request.headers.get("Idempotency-Key") || crypto.randomUUID() });
  return NextResponse.json(result, { status: 201 });
}
