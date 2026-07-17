import { NextRequest, NextResponse } from "next/server";
import { payBill } from "../../../../lib/server/moov-money";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.provider || !body.reference || Number(body.amount) <= 0) return NextResponse.json({ error: "Informations de facture invalides" }, { status: 400 });
  return NextResponse.json(await payBill(body.customerId || "demo-user", { provider: body.provider, reference: body.reference, amount: Number(body.amount), confirmationToken: body.confirmationToken || "demo-confirmation", idempotencyKey: request.headers.get("Idempotency-Key") || crypto.randomUUID() }), { status: 201 });
}
