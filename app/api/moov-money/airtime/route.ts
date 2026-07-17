import { NextRequest, NextResponse } from "next/server";
import { purchaseAirtime } from "../../../../lib/server/moov-money";
import { verifyConfirmationToken } from "../../../../lib/server/session";
import { db, hasDatabase } from "../../../../lib/server/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.recipient || !Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) return NextResponse.json({ error: "Numéro ou montant invalide" }, { status: 400 });
    if (!body.confirmationToken && process.env.NODE_ENV === "production") return NextResponse.json({ error: "Confirmation biométrique obligatoire" }, { status: 401 });
    const confirmation = body.confirmationToken ? await verifyConfirmationToken(body.confirmationToken) : undefined;
    if (confirmation?.context && (confirmation.context.type !== "airtime" || confirmation.context.recipient !== body.recipient || Number(confirmation.context.amount) !== Number(body.amount))) {
      return NextResponse.json({ error: "La recharge ne correspond pas à la confirmation biométrique" }, { status: 400 });
    }
    const user = confirmation && hasDatabase() ? await db().user.findUnique({ where: { id: confirmation.userId } }) : undefined;
    const customerId = user?.phone || (process.env.NODE_ENV !== "production" ? body.customerId || "demo-user" : "");
    if (!customerId) return NextResponse.json({ error: "Session client invalide" }, { status: 401 });
    return NextResponse.json(await purchaseAirtime(customerId, { recipient: body.recipient, amount: Number(body.amount), confirmationToken: body.confirmationToken || "development-only", idempotencyKey: request.headers.get("Idempotency-Key") || crypto.randomUUID() }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Recharge impossible" }, { status: 400 });
  }
}
