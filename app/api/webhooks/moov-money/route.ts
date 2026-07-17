import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "../../../../lib/server/db";
import { audit } from "../../../../lib/server/audit";

function validSignature(raw: string, signature: string | null) {
  const secret = process.env.MOOV_MONEY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const supplied = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

const statuses = new Set(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]);

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-moov-signature"))) return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  let event: Record<string, unknown>;
  try { event = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 }); }
  if (!event.id || !event.type) return NextResponse.json({ error: "Événement incomplet" }, { status: 400 });
  const eventId = String(event.id).slice(0, 128);
  const transactionStatus = event.status ? String(event.status).toUpperCase() : undefined;
  if (event.transactionId && transactionStatus && !statuses.has(transactionStatus)) return NextResponse.json({ error: "Statut de transaction inconnu" }, { status: 400 });
  if (hasDatabase() && event.customerId) {
    const duplicate = await db().auditEvent.findFirst({ where: { action: "webhook.moov_money", resourceId: eventId } });
    if (duplicate) return NextResponse.json({ received: true, duplicate: true });
    const user = await db().user.upsert({ where: { phone: String(event.customerId) }, update: {}, create: { phone: String(event.customerId) } });
    await db().notification.create({ data: { userId: user.id, type: String(event.type || "transaction"), title: String(event.title || "Mise à jour Moov Money"), body: String(event.message || "Une opération a été mise à jour.") } });
    if (event.transactionId && transactionStatus) {
      await db().transaction.updateMany({ where: { externalId: String(event.transactionId) }, data: { status: transactionStatus as "PENDING"|"PROCESSING"|"COMPLETED"|"FAILED"|"CANCELLED" } });
    }
    await audit("webhook.moov_money", "event", "accepted", { userId: user.id, resourceId: eventId, metadata: { type: event.type } });
  }
  return NextResponse.json({ received: true });
}
