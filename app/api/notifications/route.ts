import { NextRequest, NextResponse } from "next/server";
import { db, hasDatabase } from "../../../lib/server/db";
import { authenticatedUser, authenticationStatus } from "../../../lib/server/auth";

export async function GET(request: NextRequest) {
  try {
    const authenticated = await authenticatedUser(request, request.nextUrl.searchParams.get("customerId") || "demo-user");
    if (!hasDatabase()) return NextResponse.json({ items: [], mock: true });
    return NextResponse.json({ items: await db().notification.findMany({ where: { userId: authenticated.id }, orderBy: { createdAt: "desc" }, take: 100 }) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Accès refusé" }, { status: authenticationStatus(error) }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const user = await authenticatedUser(request, body.customerId || "demo-user");
    if (!hasDatabase()) return NextResponse.json({ updated: 0, mock: true });
    const result = await db().notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ updated: result.count });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Accès refusé" }, { status: authenticationStatus(error) }); }
}
