import { NextRequest, NextResponse } from "next/server";
import { createTicket } from "../../../lib/server/ticketing";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.category || !body.description || body.description.length < 15) return NextResponse.json({ error: "Catégorie et description détaillée obligatoires" }, { status: 400 });
  const ticket = await createTicket({ customerId: body.customerId || "demo-user", category: body.category, description: body.description, conversationId: body.conversationId, summary: body.summary });
  return NextResponse.json(ticket, { status: 201 });
}
