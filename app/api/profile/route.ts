import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser, authenticationStatus } from "../../../lib/server/auth";
import { audit } from "../../../lib/server/audit";
import { db, hasDatabase } from "../../../lib/server/db";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser(request, request.nextUrl.searchParams.get("customerId") || "demo-user");
    if (!hasDatabase()) return NextResponse.json({ phone: user.phone, displayName: "Jean Direl Nze", locale: "fr", mock: true });
    return NextResponse.json(await db().user.findUnique({ where: { id: user.id }, select: { phone: true, displayName: true, locale: true, createdAt: true } }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Accès refusé" }, { status: authenticationStatus(error) }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticatedUser(request, "demo-user");
    const body = await request.json();
    const locale = ["fr", "en", "fang", "myene"].includes(body.locale) ? body.locale : undefined;
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 100) : undefined;
    if (!locale && !displayName) return NextResponse.json({ error: "Aucune modification valide" }, { status: 400 });
    if (!hasDatabase()) return NextResponse.json({ phone: user.phone, displayName, locale, mock: true });
    const updated = await db().user.update({ where: { id: user.id }, data: { displayName, locale }, select: { phone: true, displayName: true, locale: true } });
    await audit("profile.update", "user", "success", { userId: user.id, resourceId: user.id, metadata: { locale, displayNameChanged: Boolean(displayName) } });
    return NextResponse.json(updated);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Mise à jour impossible" }, { status: authenticationStatus(error) }); }
}
