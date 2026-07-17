import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "../../../../lib/server/db";

function authorized(request: NextRequest) {
  const expected = process.env.ADMIN_API_KEY; const supplied = request.headers.get("x-admin-api-key");
  if (!expected || !supplied) return false;
  return expected.length === supplied.length && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Accès administrateur refusé" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ users: 31204, transactions: 8427, openTickets: 38, kycPending: 21, mock: true });
  const [users, transactions, openTickets, kycPending] = await Promise.all([
    db().user.count(), db().transaction.count(), db().ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }), db().kycApplication.count({ where: { status: "PENDING_REVIEW" } }),
  ]);
  return NextResponse.json({ users, transactions, openTickets, kycPending, generatedAt: new Date().toISOString() });
}
