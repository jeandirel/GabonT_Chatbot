import { NextRequest, NextResponse } from "next/server";
import { payBill } from "../../../../lib/server/moov-money";
import { verifyConfirmationToken } from "../../../../lib/server/session";
import { db, hasDatabase } from "../../../../lib/server/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.provider || !body.reference || Number(body.amount) <= 0) return NextResponse.json({ error: "Informations de facture invalides" }, { status: 400 });
  if (!body.confirmationToken && process.env.NODE_ENV === "production") return NextResponse.json({ error: "Confirmation biométrique obligatoire" }, { status: 401 });
  const confirmation = body.confirmationToken ? await verifyConfirmationToken(body.confirmationToken) : undefined;
  if (confirmation?.context && (confirmation.context.type !== "bill" || confirmation.context.provider !== body.provider || confirmation.context.reference !== body.reference || Number(confirmation.context.amount) !== Number(body.amount))) return NextResponse.json({ error: "La facture ne correspond pas à la confirmation biométrique" }, { status: 400 });
  const user = confirmation && hasDatabase() ? await db().user.findUnique({ where: { id: confirmation.userId } }) : undefined;
  const customerId = user?.phone || (process.env.NODE_ENV !== "production" ? body.customerId || "demo-user" : "");
  if (!customerId) return NextResponse.json({ error: "Session client invalide" }, { status: 401 });
  return NextResponse.json(await payBill(customerId, { provider: body.provider, reference: body.reference, amount: Number(body.amount), confirmationToken: body.confirmationToken || "development-only", idempotencyKey: request.headers.get("Idempotency-Key") || crypto.randomUUID() }), { status: 201 });
}
