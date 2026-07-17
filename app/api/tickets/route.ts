import { NextRequest, NextResponse } from "next/server";
import { createTicket } from "../../../lib/server/ticketing";
import { authenticatedUser, authenticationStatus } from "../../../lib/server/auth";
import { db, hasDatabase } from "../../../lib/server/db";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser(request, request.nextUrl.searchParams.get("customerId") || "demo-user");
    if (!hasDatabase()) return NextResponse.json({ items: [], mock: true });
    const items = await db().ticket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json({ items });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Accès refusé" }, { status: authenticationStatus(error) }); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.category || !body.description || body.description.length < 15) return NextResponse.json({ error: "Catégorie et description détaillée obligatoires" }, { status: 400 });
    const user = await authenticatedUser(request, body.customerId || "demo-user");
    const ticket = await createTicket({ customerId: user.phone, category: body.category, description: body.description, conversationId: body.conversationId, summary: body.summary });
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Création impossible" }, { status: authenticationStatus(error) }); }
}
