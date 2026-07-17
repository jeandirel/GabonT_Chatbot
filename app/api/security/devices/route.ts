import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser, authenticationStatus } from "../../../../lib/server/auth";
import { audit } from "../../../../lib/server/audit";
import { db, hasDatabase } from "../../../../lib/server/db";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser(request, request.nextUrl.searchParams.get("customerId") || "demo-user");
    if (!hasDatabase()) return NextResponse.json({ items: [], mock: true });
    const items = await db().webAuthnCredential.findMany({ where: { userId: user.id }, select: { id: true, deviceType: true, backedUp: true, transports: true, createdAt: true, lastUsedAt: true }, orderBy: { lastUsedAt: "desc" } });
    return NextResponse.json({ items });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Accès refusé" }, { status: authenticationStatus(error) }); }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticatedUser(request, "demo-user");
    if (!hasDatabase()) return NextResponse.json({ revoked: true, mock: true });
    const body = await request.json();
    const count = await db().webAuthnCredential.count({ where: { userId: user.id } });
    if (count <= 1) return NextResponse.json({ error: "Ajoutez une autre passkey avant de révoquer la dernière." }, { status: 409 });
    const result = await db().webAuthnCredential.deleteMany({ where: { id: String(body.credentialId || ""), userId: user.id } });
    if (!result.count) return NextResponse.json({ error: "Appareil introuvable" }, { status: 404 });
    await audit("webauthn.revoke", "credential", "success", { userId: user.id, resourceId: String(body.credentialId) });
    return NextResponse.json({ revoked: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Révocation impossible" }, { status: authenticationStatus(error) }); }
}
